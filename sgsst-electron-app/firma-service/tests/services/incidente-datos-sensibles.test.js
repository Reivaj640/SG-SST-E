/**
 * EL 10.8(d) · CARGA ACCIDENTAL DE DATOS DE SALUD
 * ===============================================
 *
 * Lo que estos tests fijan, numeral por numeral:
 *
 *   (i)   la solicitud queda BLOQUEADA: no se puede firmar ni reimprimir, y
 *         queda RETENIDA (no se suprime) mientras se resuelve el reporte.
 *   (ii)  el documento queda AISLADO: no se comunica, no se usa para otra
 *         finalidad, y se conserva solo mientras se resuelve el reporte.
 *   (iii) queda el EVENTO con la trazabilidad minima: fecha y hora, quien
 *         reporta, la causa invocada y las medidas adoptadas (el 3.6(g)).
 *   (iv)  la EMPRESA recibe el aviso por su canal de incidentes, con la
 *         noticia de que la solicitud quedo bloqueada.
 *   (v)   al resolver el reporte se LIBERA el hold y el documento queda
 *         disponible para la via de supresion del 8.6.
 *
 * Y lo que NO se construye (es de la Empresa, que es la Responsable):
 * el aislamiento del documento original en poder de la Empresa, la
 * notificacion al Titular y el reporte a la autoridad.
 *
 * No abre la base de datos de produccion: usa la BD de tests (tests/setup.js).
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const db = require('../../src/db/connection');
const empresaService = require('../../src/services/empresa');
const incidentes = require('../../src/services/incidenteSalud');
const mailer = require('../../src/services/mailer');
const {
  resetDb, makeApp, createSignRequestWithIdentificacion, TEST_ADMIN_API_KEY,
} = require('../helpers');

const EMPRESA = '900123456';
const CAUSA = 'El PDF cargado incluye un examen de laboratorio del trabajador';

const HEADERS_ADMIN = { 'X-Admin-API-Key': TEST_ADMIN_API_KEY };

/**
 * Deja la base limpia y la Empresa dada de alta.
 *
 * @param {object} [opciones]
 * @param {string|null} [opciones.canal_incidentes]
 * @param {string|null} [opciones.responsable_correo]
 */
function _empresa({ canal_incidentes = 'seguridad@example.com', responsable_correo = 'privacidad@example.com' } = {}) {
  resetDb();
  db.prepare('DELETE FROM gh_firma_empresas WHERE id_empresa = ?').run(EMPRESA);
  empresaService.create({
    id_empresa: EMPRESA,
    razon_social: 'Empresa de Prueba S.A.S.',
    nit: EMPRESA,
    domicilio: 'Bogota D.C.',
    representante_legal: 'Persona Representante',
    representante_legal_identificacion: 'CC 1010101010',
    responsable_tratamiento: 'Responsable de Prueba',
    responsable_tratamiento_correo: responsable_correo,
    canal_pqrs: 'pqrs@example.com',
    canal_incidentes,
    plazo_retencion: '5 años',
    canal_solicitud_copia: 'privacidad@example.com',
    plazo_retencion_dias: 1825,
  });
  // D-03: sin Anexo de Encargo firmado, la empresa no puede pedir firmas.
  empresaService.marcarAnexoFirmado(EMPRESA, '2026-10-20');
}

/**
 * Una solicitud de firma lista para reportar.
 */
async function _solicitud() {
  const creada = await createSignRequestWithIdentificacion({
    id_empresa: EMPRESA,
    id_documento: 'doc-incidente-001',
  });
  mailer.clearDevInbox();
  return creada;
}

/**
 * Los eventos de una firma.
 */
function _eventos(firmaId) {
  return db.prepare(
    'SELECT evento, metadata, id_actor, fecha_hora FROM gh_firma_eventos WHERE firma_id = ? ORDER BY id'
  ).all(firmaId);
}

// ===========================================================================
// (i) El bloqueo
// ===========================================================================

test('10.8(d)(i) · el reporte deja la solicitud bloqueada', async () => {
  _empresa();
  const { signRequest } = await _solicitud();

  await incidentes.reportar({
    id_solicitud: signRequest.id_solicitud,
    reporta: 'operador:kair',
    causa: CAUSA,
  });

  const fila = db.prepare('SELECT estado, hold_legal FROM gh_firmas_electronicas WHERE id = ?')
    .get(signRequest.id);
  assert.equal(fila.estado, 'REVOKED',
    'la solicitud tiene que quedar en un estado terminal: si no, se puede seguir firmando');
  assert.equal(Number(fila.hold_legal), 1,
    'la solicitud tiene que quedar retenida: sin hold, se suprime y se acaba la evidencia');
});

test('10.8(d)(i) · con la solicitud bloqueada NO se puede firmar ni reimprimir', async () => {
  _empresa();
  const { signRequest, token } = await _solicitud();

  await incidentes.reportar({
    id_solicitud: signRequest.id_solicitud,
    reporta: 'operador:kair',
    causa: CAUSA,
  });

  const app = makeApp();

  // El enlace de firma: la mini-app no abre.
  const contexto = await request(app).get(`/s/${token}`).set('Accept', 'application/json');
  assert.equal(contexto.status, 410,
    'el enlace de firma tiene que estar muerto: es el mismo enlace por el que se firma');

  // La reimpresion: ni el PDF original ni el firmado ni la Constancia.
  const pdf = await request(app).get(`/api/sign/${token}/document.pdf`);
  assert.equal(pdf.status, 410, 'no se puede reimprimir el documento');

  const firmado = await request(app).get(`/api/sign/${token}/signed-document.pdf`);
  assert.equal(firmado.status, 410, 'no se puede reimprimir el documento firmado');

  const constancia = await request(app).get(`/api/sign/${token}/constancia.pdf`);
  assert.equal(constancia.status, 410, 'no se puede reimprimir la Constancia');
});

test('10.8(d)(i) · el hold deja la firma NO elegible para supresion', async () => {
  _empresa();
  const { signRequest } = await _solicitud();

  // El plazo ya vencido: el UNICO freno para la supresion es el hold. Asi el
  // test muerde: si el hold no estuviera, la firma seria elegible.
  db.prepare('UPDATE gh_firmas_electronicas SET fecha_conservacion = ? WHERE id = ?')
    .run('2020-01-01T00:00:00.000Z', signRequest.id);

  await incidentes.reportar({
    id_solicitud: signRequest.id_solicitud,
    reporta: 'operador:kair',
    causa: CAUSA,
  });

  const conservacion = require('../../src/services/conservacion');
  const fila = db.prepare(
    'SELECT id, hold_legal, fecha_conservacion FROM gh_firmas_electronicas WHERE id = ?'
  ).get(signRequest.id);
  assert.equal(conservacion.esElegible(fila), false,
    'una firma retenida no puede ser elegible para supresion mientras se resuelve el reporte');

  const holds = db.prepare('SELECT actor, motivo, activo FROM gh_firma_holds WHERE firma_id = ?')
    .all(signRequest.id);
  assert.equal(holds.length, 1, 'el hold queda declarado en el historial');
  assert.equal(holds[0].activo, 1);
  assert.equal(holds[0].actor, 'operador:kair', 'el hold dice QUIEN lo declara');
});

// ===========================================================================
// (iii) El registro
// ===========================================================================

test('10.8(d)(iii) · queda el evento con fecha, quien reporta, causa y medidas', async () => {
  _empresa();
  const { signRequest } = await _solicitud();

  await incidentes.reportar({
    id_solicitud: signRequest.id_solicitud,
    reporta: 'operador:kair',
    causa: CAUSA,
    medidas: ['La Empresa recibio el archivo por el formulario de carga'],
  });

  const eventos = _eventos(signRequest.id);
  const inc = eventos.find((e) => e.evento === incidentes.EVENTO_INCIDENTE);
  assert.ok(inc, 'tiene que quedar un evento del incidente');

  // Fecha y hora: las tiene la fila (append-only).
  assert.match(inc.fecha_hora, /^\d{4}-\d{2}-\d{2}T/, 'el evento tiene fecha y hora');

  const meta = JSON.parse(inc.metadata);
  assert.equal(meta.reporta, 'operador:kair', 'el evento dice QUIEN reporta');
  assert.equal(meta.causa, CAUSA, 'el evento dice la causa invocada');
  assert.ok(Array.isArray(meta.medidas) && meta.medidas.length >= 4,
    'el evento dice las medidas adoptadas');
  assert.ok(meta.medidas.some((m) => /bloqueada/i.test(m)), 'las medidas dicen el bloqueo');
  assert.ok(meta.medidas.some((m) => /retenido/i.test(m)), 'las medidas dicen la retencion');
  assert.ok(meta.medidas.includes('La Empresa recibio el archivo por el formulario de carga'),
    'las medidas declaradas por quien reporta tambien quedan');
});

test('10.8(d)(iii) · el evento es de solo anadir: el registro no se altera', async () => {
  _empresa();
  const { signRequest } = await _solicitud();

  await incidentes.reportar({
    id_solicitud: signRequest.id_solicitud,
    reporta: 'operador:kair',
    causa: CAUSA,
  });

  const antes = _eventos(signRequest.id).length;
  // Un UPDATE sobre el registro de eventos tiene que ser rechazado por el
  // trigger append-only (migracion 020). En el ambiente de test los triggers
  // no estan instalados, asi que la garantia se comprueba contra el archivo
  // real de la migracion.
  const fs = require('fs');
  const path = require('path');
  const sql = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'db', 'schema', '020_eventos_append_only.sql'), 'utf8');
  assert.ok(sql.includes('trg_firma_eventos_no_update'),
    'la migracion 020 tiene que instalar el trigger de no-update');
  assert.ok(sql.includes('trg_firma_eventos_no_delete'),
    'la migracion 020 tiene que instalar el trigger de no-delete');
  assert.ok(sql.includes('COALESCE(f.hold_legal, 0) = 1'),
    'el trigger tiene que negarse a tocar el evento de una firma retenida');
  assert.ok(antes >= 1);
});

test('10.8(d)(iii) · el tipo de evento tiene etiqueta legible en el PDF y en la app', () => {
  const pdfGen = require('../../src/services/pdfGen');
  assert.equal(pdfGen.EVENTO_LABEL[incidentes.EVENTO_INCIDENTE],
    'Incidente de carga accidental de datos de salud');
  assert.equal(pdfGen.EVENTO_LABEL[incidentes.EVENTO_RESUELTO],
    'Incidente de datos de salud resuelto');

  const app = fsReadElectron();
  assert.ok(app.includes(`INCIDENTE_DATOS_SENSIBLES:`),
    'la app Electron tiene que tener la etiqueta del incidente');
  assert.ok(app.includes('Carga accidental de datos de salud'),
    'la app Electron muestra la etiqueta, no el nombre crudo');
  assert.ok(app.includes('INCIDENTE_DATOS_SENSIBLES_RESUELTO:'),
    'la app Electron tiene que tener la etiqueta de la resolucion');
});

/**
 * El texto del modulo Electron de la firma electronica.
 */
function fsReadElectron() {
  const fs = require('fs');
  const path = require('path');
  return fs.readFileSync(path.join(__dirname, '..', '..', '..', 'modules',
    'gestion-humana', 'firma-electronica', 'index.js'), 'utf8');
}

// ===========================================================================
// (iv) El aviso a la Empresa
// ===========================================================================

test('10.8(d)(iv) · la Empresa recibe el aviso por su canal de incidentes', async () => {
  _empresa({ canal_incidentes: 'seguridad@example.com' });
  const { signRequest } = await _solicitud();

  const resultado = await incidentes.reportar({
    id_solicitud: signRequest.id_solicitud,
    reporta: 'operador:kair',
    causa: CAUSA,
  });

  assert.equal(resultado.notificacion.enviada, true, 'el aviso tiene que salir');
  assert.equal(resultado.notificacion.destinatario, 'seguridad@example.com');
  assert.equal(resultado.notificacion.origen_canal, 'canal_incidentes');

  const inbox = mailer.getDevInbox();
  const aviso = inbox.find((e) => e.tipo === 'incidente_datos_sensibles');
  assert.ok(aviso, 'el aviso queda en la bandeja de dev');
  assert.equal(aviso.to, 'seguridad@example.com');
  assert.equal(aviso.canal, 'canal_incidentes',
    'el aviso deja constancia de que salio por el canal de incidentes');
  assert.ok(aviso.body.includes(signRequest.id_solicitud), 'el aviso dice que solicitud es');
  assert.ok(/bloqueada/i.test(aviso.body), 'el aviso informa de que la solicitud quedo bloqueada');
  assert.equal(aviso.attachments, undefined, 'el aviso NO lleva adjunto');
});

test('10.8(d)(iv) · el aviso NO lleva el documento ni un enlace de descarga', async () => {
  _empresa();
  const { signRequest } = await _solicitud();

  await incidentes.reportar({
    id_solicitud: signRequest.id_solicitud,
    reporta: 'operador:kair',
    causa: CAUSA,
  });

  const aviso = mailer.getDevInbox().find((e) => e.tipo === 'incidente_datos_sensibles');
  assert.ok(aviso);
  assert.ok(!/\/s\//.test(aviso.body), 'el aviso no lleva ningun enlace de firma');
  assert.ok(!/https?:\/\//.test(aviso.body), 'el aviso no lleva ninguna URL');
  assert.equal(aviso.attachments, undefined, 'el aviso no lleva adjunto');
});

test('10.8(d)(iv) · sin correo en el canal de incidentes, cae al responsable de tratamiento', async () => {
  _empresa({
    canal_incidentes: 'https://ejemplo.co/incidentes',
    responsable_correo: 'privacidad@example.com',
  });
  const { signRequest } = await _solicitud();

  const resultado = await incidentes.reportar({
    id_solicitud: signRequest.id_solicitud,
    reporta: 'operador:kair',
    causa: CAUSA,
  });

  assert.equal(resultado.notificacion.enviada, true);
  assert.equal(resultado.notificacion.destinatario, 'privacidad@example.com');
  assert.equal(resultado.notificacion.origen_canal, 'responsable_tratamiento_correo');
  assert.ok(resultado.notificacion.motivo_fallback,
    'el resultado deja constancia de por que se uso el otro canal');
});

test('10.8(d)(iv) · sin ningun correo, el reporte se registra igual y deja constancia', async () => {
  _empresa({ canal_incidentes: null, responsable_correo: null });
  const { signRequest } = await _solicitud();

  const resultado = await incidentes.reportar({
    id_solicitud: signRequest.id_solicitud,
    reporta: 'operador:kair',
    causa: CAUSA,
  });

  // Un reporte NUNCA falla por falta de correo.
  assert.equal(resultado.notificacion.enviada, false);
  assert.equal(resultado.notificacion.destinatario, null);
  assert.ok(resultado.notificacion.motivo_fallback);

  // Y queda constancia: el evento dice que el aviso no salio.
  const inc = _eventos(signRequest.id).find((e) => e.evento === incidentes.EVENTO_INCIDENTE);
  assert.ok(inc, 'el reporte quedo registrado igual');
  const meta = JSON.parse(inc.metadata);
  assert.equal(meta.notificacion.enviada, false);
  assert.ok(meta.notificacion.motivo_fallback);

  // Y el bloqueo y la retencion tampoco dependen del correo.
  const fila = db.prepare('SELECT estado, hold_legal FROM gh_firmas_electronicas WHERE id = ?')
    .get(signRequest.id);
  assert.equal(fila.estado, 'REVOKED');
  assert.equal(Number(fila.hold_legal), 1);
});

// ===========================================================================
// (ii) El aislamiento
// ===========================================================================

test('10.8(d)(ii) · el documento queda aislado: no comunicado, no usado, conservado', async () => {
  _empresa();
  const { signRequest } = await _solicitud();

  const resultado = await incidentes.reportar({
    id_solicitud: signRequest.id_solicitud,
    reporta: 'operador:kair',
    causa: CAUSA,
  });

  assert.equal(resultado.aislamiento.documento_comunicado, false);
  assert.equal(resultado.aislamiento.documento_en_correo, false);
  assert.equal(resultado.aislamiento.enlace_de_descarga, false);
  assert.equal(resultado.aislamiento.conservado_hasta_resolver_el_reporte, true);

  // Y el archivo sigue en el almacenamiento de K+AIR: no se borro, no se movio.
  const fila = db.prepare('SELECT pdf_original_path FROM gh_firmas_electronicas WHERE id = ?')
    .get(signRequest.id);
  assert.ok(fila.pdf_original_path, 'el archivo sigue guardado: el 8.6 lo suprime cuando toque');
  const storage = require('../../src/services/storage');
  assert.ok(storage.exists(fila.pdf_original_path), 'el archivo no se elimina al reportar');
});

// ===========================================================================
// (v) La resolucion
// ===========================================================================

test('10.8(d)(v) · al resolver el reporte se libera el hold', async () => {
  _empresa();
  const { signRequest } = await _solicitud();

  await incidentes.reportar({
    id_solicitud: signRequest.id_solicitud,
    reporta: 'operador:kair',
    causa: CAUSA,
  });

  const resultado = incidentes.resolver({
    id_solicitud: signRequest.id_solicitud,
    resuelve: 'operador:kair',
    causa: 'La Empresa withdrew el documento y el trabajador fue informado',
  });

  assert.equal(resultado.liberacion.liberado, true, 'el hold del incidente se libera');

  const fila = db.prepare('SELECT hold_legal, hold_liberado_at FROM gh_firmas_electronicas WHERE id = ?')
    .get(signRequest.id);
  assert.equal(Number(fila.hold_legal), 0, 'la firma ya no esta retenida');
  assert.ok(fila.hold_liberado_at, 'la liberacion queda con fecha');

  // El historial de holds conserva la declaracion y la liberacion.
  const holds = db.prepare('SELECT activo, liberado_por FROM gh_firma_holds WHERE firma_id = ?')
    .all(signRequest.id);
  assert.equal(holds.length, 1);
  assert.equal(holds[0].activo, 0, 'el hold queda marcado como liberado');
  assert.equal(holds[0].liberado_por, 'operador:kair');
});

test('10.8(d)(v) · resuelto el reporte, el documento queda disponible para el 8.6', async () => {
  _empresa();
  const { signRequest } = await _solicitud();

  await incidentes.reportar({
    id_solicitud: signRequest.id_solicitud,
    reporta: 'operador:kair',
    causa: CAUSA,
  });
  incidentes.resolver({
    id_solicitud: signRequest.id_solicitud,
    resuelve: 'operador:kair',
    causa: 'Resuelto',
  });

  // El motor de purga (el del 8.6) tiene que ver la firma sin el freno del
  // hold. Con el plazo vencido, la firma es elegible: eso es "disponible para
  // la via del 8.6".
  const conservacion = require('../../src/services/conservacion');
  db.prepare('UPDATE gh_firmas_electronicas SET fecha_conservacion = ? WHERE id = ?')
    .run('2020-01-01T00:00:00.000Z', signRequest.id);
  const fila = db.prepare(
    'SELECT id, hold_legal, fecha_conservacion FROM gh_firmas_electronicas WHERE id = ?'
  ).get(signRequest.id);
  assert.equal(conservacion.esElegible(fila), true,
    'resuelto el reporte, la firma vuelve a la via normal de supresion del 8.6');
});

test('10.8(d)(v) · la resolucion queda registrada en el registro de eventos', async () => {
  _empresa();
  const { signRequest } = await _solicitud();

  await incidentes.reportar({
    id_solicitud: signRequest.id_solicitud,
    reporta: 'operador:kair',
    causa: CAUSA,
  });
  incidentes.resolver({
    id_solicitud: signRequest.id_solicitud,
    resuelve: 'responsable:rrhh',
    causa: 'La Empresa withdrew el documento',
  });

  const res = _eventos(signRequest.id).find((e) => e.evento === incidentes.EVENTO_RESUELTO);
  assert.ok(res, 'la resolucion queda en el registro');
  const meta = JSON.parse(res.metadata);
  assert.equal(meta.resuelve, 'responsable:rrhh');
  assert.equal(meta.causa, 'La Empresa withdrew el documento');
  assert.equal(meta.liberacion.liberado, true);
});

test('10.8(d)(v) · resolver sin incidente previo falla', () => {
  _empresa();
  assert.throws(
    () => incidentes.resolver({
      id_solicitud: 'SIGN-2026-000000',
      resuelve: 'x',
      causa: 'y',
    }),
    /no existe|INCIDENTE/i
  );
});

// ===========================================================================
// El endpoint
// ===========================================================================

test('10.8(d) · el endpoint admin registra el reporte', async () => {
  _empresa();
  const { signRequest } = await _solicitud();
  const app = makeApp();

  const res = await request(app)
    .post(`/internal/admin/sign-requests/${signRequest.id_solicitud}/incidente-datos-sensibles`)
    .set(HEADERS_ADMIN)
    .set('X-Admin-Actor', 'operador:juan')
    .send({ causa: CAUSA });

  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.estado, 'REVOKED');
  assert.equal(res.body.notificacion.enviada, true);

  const inc = _eventos(signRequest.id).find((e) => e.evento === incidentes.EVENTO_INCIDENTE);
  assert.ok(inc);
  assert.equal(JSON.parse(inc.metadata).reporta, 'operador:juan',
    'el operador del header es quien reporta');
});

test('10.8(d) · el endpoint admin resuelve el reporte', async () => {
  _empresa();
  const { signRequest } = await _solicitud();
  const app = makeApp();

  await request(app)
    .post(`/internal/admin/sign-requests/${signRequest.id_solicitud}/incidente-datos-sensibles`)
    .set(HEADERS_ADMIN)
    .send({ causa: CAUSA });

  const res = await request(app)
    .post(`/internal/admin/sign-requests/${signRequest.id_solicitud}/incidente-datos-sensibles/resolver`)
    .set(HEADERS_ADMIN)
    .send({ causa: 'Resuelto' });

  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.liberacion.liberado, true);
});

test('10.8(d) · el endpoint admin exige la API key administrativa', async () => {
  _empresa();
  const { signRequest } = await _solicitud();
  const app = makeApp();

  const res = await request(app)
    .post(`/internal/admin/sign-requests/${signRequest.id_solicitud}/incidente-datos-sensibles`)
    .send({ causa: CAUSA });

  assert.equal(res.status, 401);
});

test('10.8(d) · el endpoint admin valida el cuerpo', async () => {
  _empresa();
  const { signRequest } = await _solicitud();
  const app = makeApp();

  const res = await request(app)
    .post(`/internal/admin/sign-requests/${signRequest.id_solicitud}/incidente-datos-sensibles`)
    .set(HEADERS_ADMIN)
    .send({});

  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_REQUEST_BODY');
});

// ===========================================================================
// Mutaciones
// ===========================================================================

test('MUTACION · sin el bloqueo, el enlace de firma sigue vivo', async () => {
  // Si el reporte no bloqueara la solicitud, el enlace seguiria sirviendo la
  // mini-app: el 10.8(d)(i) estaria incumplido. Esto acota el test: el
  // bloqueo es lo que hace que el enlace muera.
  _empresa();
  const { signRequest, token } = await _solicitud();

  const antes = await request(makeApp()).get(`/s/${token}`).set('Accept', 'application/json');
  assert.equal(antes.status, 200, 'sin el reporte, el enlace abre');

  await incidentes.reportar({
    id_solicitud: signRequest.id_solicitud,
    reporta: 'operador:kair',
    causa: CAUSA,
  });

  const despues = await request(makeApp()).get(`/s/${token}`).set('Accept', 'application/json');
  assert.equal(despues.status, 410, 'con el reporte, el enlace muere');
});

test('MUTACION · sin el evento, no queda trazabilidad del reporte', async () => {
  // Si el servicio no escribiera el evento, el reporte seria invisible: el
  // 3.6(g) exige que quede el registro. Se comprueba mirando lo que HAY.
  _empresa();
  const { signRequest } = await _solicitud();

  const antes = _eventos(signRequest.id)
    .filter((e) => e.evento === incidentes.EVENTO_INCIDENTE).length;
  assert.equal(antes, 0, 'antes del reporte no hay evento de incidente');

  await incidentes.reportar({
    id_solicitud: signRequest.id_solicitud,
    reporta: 'operador:kair',
    causa: CAUSA,
  });

  const despues = _eventos(signRequest.id)
    .filter((e) => e.evento === incidentes.EVENTO_INCIDENTE).length;
  assert.equal(despues, 1, 'el reporte deja exactamente un evento de incidente');
});
