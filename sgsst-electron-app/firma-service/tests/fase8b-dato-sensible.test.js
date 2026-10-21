/**
 * 8B · LOS DOCUMENTOS CON INFORMACIÓN DE SALUD (numeral 10.8)
 * =============================================================================
 *
 * El 10.8(a): "Cuando un documento objeto de firma contenga información
 * relativa a la salud, el Titular debe ser informado de manera explícita y
 * previa de que el dato es sensible, de cuáles son los datos que serán objeto
 * de tratamiento y de la finalidad de éste, y debe otorgar su consentimiento
 * expreso [...] debe informársele igualmente que, por tratarse de datos
 * sensibles, no está obligado a autorizar su tratamiento."
 *
 * El 10.8(c): la base legal es la autorización expresa del Titular; si la
 * Empresa fundara el tratamiento en otra, debe informarlo de forma expresa y
 * anticipada.
 *
 * Lo que comprueban estos tests:
 *
 *   1. La clasificación: se INFIERE del tipo de documento, y la Empresa solo
 *      puede subirla, no bajarla.
 *   2. El aviso se FIJA con su huella, y dice lo que el 10.8(a) exige.
 *   3. El documento NO se sirve sin la autorización (el aviso es previo).
 *   4. La autorización se REGISTRA como prueba, con lo que se le informó.
 *   5. No autorizar es el derecho del Titular, y también queda probado.
 *   6. Con otra base legal (10.8(c)), se informa pero no hay que autorizar.
 *   7. MUTACION: los checks muerden.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const db = require('../src/db/connection');
const sensibles = require('../src/services/sensibles');
const {
  resetDb, makeApp, createSignRequestWithIdentificacion,
} = require('./helpers');

/**
 * Deja la solicitud en OTP_VERIFIED (el estado mínimo para que el documento
 * pueda servirse) y devuelve el token.
 */
async function setupVerificado(overrides = {}) {
  const { token, signRequest } = await createSignRequestWithIdentificacion({
    id_trabajador: '1234567890',
    id_empresa: '900123456',
    identificacion_numero: '1234567890',
    ...overrides,
  });
  db.prepare(`
    UPDATE gh_firmas_electronicas
       SET estado = 'OTP_VERIFIED'
     WHERE id = ?
  `).run(signRequest.id);
  return { token, signRequest };
}

// =========================================================================
// 1. La clasificación
// =========================================================================

test('8B · un ACTA se infiere sensible aunque la Empresa no lo declare', async () => {
  resetDb();
  const { signRequest } = await setupVerificado({ tipo_identificacion: 'ACTA' });

  const fila = db.prepare(
    'SELECT datos_sensibles, categorias_sensibles, base_legal_sensible, '
    + 'finalidad_sensible, aviso_sensible_hash, aviso_sensible_version '
    + 'FROM gh_firmas_electronicas WHERE id = ?'
  ).get(signRequest.id);

  assert.equal(fila.datos_sensibles, 1,
    'el acta de estilo y salud se infiere sensible: la Empresa puede subir la '
    + 'clasificación, no bajarla');
  assert.ok(fila.categorias_sensibles, 'deben quedar las categorías del tipo');
  assert.equal(fila.base_legal_sensible, 'autorizacion_expresa',
    'la base legal por defecto es la del 10.8(c)');
  assert.ok(fila.finalidad_sensible, 'debe quedar la finalidad');
  assert.ok(fila.aviso_sensible_hash, 'el aviso queda fijado con su huella');
  assert.equal(fila.aviso_sensible_version, sensibles.VERSION_AVISO);
});

test('8B · un CONTRATO no se infiere, pero la Empresa puede declararlo sensible', async () => {
  resetDb();
  const { signRequest } = await setupVerificado({ tipo_identificacion: 'CONTRATO' });

  let fila = db.prepare(
    'SELECT datos_sensibles FROM gh_firmas_electronicas WHERE id = ?'
  ).get(signRequest.id);
  assert.equal(fila.datos_sensibles, 0, 'un contrato no se infiere sensible');

  // Y si la Empresa lo declara, se respeta.
  const { signRequest: otro } = await setupVerificado({
    tipo_identificacion: 'CONTRATO',
    datos_sensibles: true,
    categorias_datos_sensibles: ['antecedentes médicos de la historia laboral'],
  });
  fila = db.prepare(
    'SELECT datos_sensibles, categorias_sensibles FROM gh_firmas_electronicas WHERE id = ?'
  ).get(otro.id);
  assert.equal(fila.datos_sensibles, 1, 'la declaración de la Empresa manda');
  assert.ok(fila.categorias_sensibles.includes('antecedentes médicos de la historia laboral'));
});

// =========================================================================
// 2. El aviso
// =========================================================================

test('8B · el aviso dice lo que el 10.8(a) exige', async () => {
  resetDb();
  const { signRequest } = await setupVerificado({ tipo_identificacion: 'CERTIFICADO' });

  const fila = db.prepare(
    'SELECT aviso_sensible_texto FROM gh_firmas_electronicas WHERE id = ?'
  ).get(signRequest.id);
  const texto = fila.aviso_sensible_texto;

  assert.ok(texto, 'el aviso debe existir');
  assert.ok(/SENSIBLE/i.test(texto), 'debe decir que el dato es sensible');
  assert.ok(/DATOS QUE SERÁN OBJETO DE TRATAMIENTO/.test(texto),
    'debe informar de cuáles son los datos');
  assert.ok(/aptitud física o mental/.test(texto),
    'debe listar las categorías concretas');
  assert.ok(/FINALIDAD:/.test(texto), 'debe informar de la finalidad');
  assert.ok(/NO ESTÁ OBLIGADO A AUTORIZAR/.test(texto),
    'debe informarle de que no está obligado a autorizar');
  assert.ok(/firma en papel/.test(texto),
    'debe ofrecer la vía alterna: el numeral 7 del Acuerdo');});

test('8B · el contexto trae el aviso con su huella y sus categorías', async () => {
  resetDb();
  const app = makeApp();
  const { token } = await setupVerificado({ tipo_identificacion: 'ACTA' });

  const res = await request(app).get(`/s/${token}`).set('Accept', 'application/json');
  assert.equal(res.status, 200);

  const d = res.body.dato_sensible;
  assert.ok(d, 'el contexto debe traer el bloque del dato sensible');
  assert.ok(d.texto, 'con el texto del aviso');
  assert.ok(d.hash, 'con su huella');
  assert.ok(d.version);
  assert.ok(Array.isArray(d.categorias) && d.categorias.length > 0);
  assert.ok(d.finalidad);
  assert.equal(d.base_legal, 'autorizacion_expresa');
  assert.equal(d.requiere_autorizacion, true);
  assert.equal(d.autorizado, false, 'todavía no se ha autorizado');
});

// =========================================================================
// 3. La puerta: el aviso es PREVIO
// =========================================================================

test('8B · el documento NO se sirve sin la autorización expresa', async () => {
  resetDb();
  const app = makeApp();
  const { token } = await setupVerificado({ tipo_identificacion: 'ACTA' });

  const res = await request(app).get(`/api/sign/${token}/document.pdf`);
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'SENSIBLE_CONSENT_NOT_ACCEPTED');
});

test('8B · con la autorización registrada, el documento se sirve', async () => {
  resetDb();
  const app = makeApp();
  const { token, signRequest } = await setupVerificado({ tipo_identificacion: 'ACTA' });

  const resConsent = await request(app)
    .post(`/api/sign/${token}/consent/sensible`)
    .send({ autoriza: true });
  assert.equal(resConsent.status, 200);
  assert.equal(resConsent.body.ok, true);

  const resPdf = await request(app).get(`/api/sign/${token}/document.pdf`);
  assert.equal(resPdf.status, 200, 'con la autorización, el documento se sirve');
  assert.ok(resPdf.body.length > 0);
});

// =========================================================================
// 4. La prueba
// =========================================================================

test('8B · la autorización queda probada con lo que se le informó', async () => {
  resetDb();
  const app = makeApp();
  const { token, signRequest } = await setupVerificado({ tipo_identificacion: 'CERTIFICADO' });

  await request(app)
    .post(`/api/sign/${token}/consent/sensible`)
    .send({ autoriza: true });

  const fila = db.prepare(
    'SELECT id_solicitud, id_empresa, id_trabajador, version_aviso, hash_aviso, '
    + 'categorias, finalidad, base_legal, manifestacion_aceptada, '
    + 'fecha_manifestacion, fecha_aceptacion '
    + 'FROM gh_consentimientos_sensibles WHERE id_solicitud = ?'
  ).get(signRequest.id_solicitud);

  assert.ok(fila, 'debe existir la prueba del consentimiento');
  assert.equal(fila.id_solicitud, signRequest.id_solicitud);
  assert.equal(fila.manifestacion_aceptada, 1);
  assert.ok(fila.version_aviso, 'la versión del aviso que se le mostró');
  assert.ok(fila.hash_aviso, 'la huella del aviso que se le mostró');
  assert.ok(fila.categorias, 'las categorías que se le informaron');
  assert.ok(fila.finalidad, 'la finalidad que se le informó');
  assert.equal(fila.base_legal, 'autorizacion_expresa');
  assert.ok(fila.fecha_manifestacion, 'la fecha en que se manifestó');
  assert.ok(fila.fecha_aceptacion);

  // El seudónimo del Titular, nunca su documento.
  assert.ok(!/^\d+$/.test(fila.id_trabajador),
    'la prueba guarda el seudónimo del Titular, no su documento');
});

test('8B · la prueba NO tiene llave foránea contra la firma (sobrevive a la 5B)', async () => {
  // El 12.7 deja en cabeza de la Empresa la prueba de la aceptación. Lo
  // mismo con la autorización del dato de salud: la 5B borra la fila de la
  // firma cuando vence el plazo, pero la prueba de que el Titular autorizó
  // tiene que sobrevivir a esa supresión.
  resetDb();
  const app = makeApp();
  const { token, signRequest } = await setupVerificado({ tipo_identificacion: 'ACTA' });

  await request(app)
    .post(`/api/sign/${token}/consent/sensible`)
    .send({ autoriza: true });

  const pragma = db.prepare('PRAGMA foreign_key_list(gh_consentimientos_sensibles)').all();
  assert.equal(pragma.length, 0,
    'la prueba del consentimiento sensible no debe tener llave foránea contra la firma');
});

// =========================================================================
// 5. No autorizar es el derecho del Titular
// =========================================================================

test('8B · no autorizar responde 409 y la NO autorización queda registrada', async () => {
  resetDb();
  const app = makeApp();
  const { token, signRequest } = await setupVerificado({ tipo_identificacion: 'ACTA' });

  const res = await request(app)
    .post(`/api/sign/${token}/consent/sensible`)
    .send({ autoriza: false });

  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'SENSIBLE_CONSENT_NOT_ACCEPTED');
  assert.equal(res.body.error.details.via_alternativa, 'firma_en_papel',
    'la respuesta debe ofrecer la vía alterna (el numeral 7 del Acuerdo)');

  // Y que no lo autorizó es un hecho que queda probado.
  const fila = db.prepare(
    'SELECT manifestacion_aceptada, fecha_manifestacion FROM gh_consentimientos_sensibles WHERE id_solicitud = ?'
  ).get(signRequest.id_solicitud);
  assert.ok(fila, 'la no autorización también se registra');
  assert.equal(fila.manifestacion_aceptada, 0);
  assert.ok(fila.fecha_manifestacion);
});

// =========================================================================
// 6. Otra base legal (10.8(c))
// =========================================================================

test('8B · con otra base legal declarada, se informa pero no hay que autorizar', async () => {
  resetDb();
  const app = makeApp();
  const { token } = await setupVerificado({
    tipo_identificacion: 'ACTA',
    datos_sensibles: true,
    base_legal_sensible: 'otra',
    base_legal_sensible_descripcion:
      'Obligación legal de conservación de historias laborales (Ley 1819 de 2016, artículo 11).',
  });

  // El aviso se muestra igual: el Titular tiene que estar informado.
  const resCtx = await request(app).get(`/s/${token}`).set('Accept', 'application/json');
  const d = resCtx.body.dato_sensible;
  assert.ok(d, 'el aviso se muestra igual');
  assert.equal(d.requiere_autorizacion, false,
    'con otra base legal no hay nada que autorizar');
  assert.ok(/Ley 1819/.test(d.texto),
    'el aviso tiene que informar de la base legal declarada');
  assert.ok(/no estás GRANTIZANDO/i.test(d.texto),
    'el aviso tiene que aclarar que no se está garantindo');

  // Y el documento se sirve sin casilla de autorización.
  const resPdf = await request(app).get(`/api/sign/${token}/document.pdf`);
  assert.equal(resPdf.status, 200);
});

test('8B · una base legal "otra" sin descripción NO se acepta: no se puede informar', async () => {
  // El 10.8(c) exige informar de la base legal. Una base sin describir no se
  // puede informar, así que el sistema cae a la del 10.8(c): la autorización
  // expresa del Titular.
  resetDb();
  const app = makeApp();
  const { token } = await setupVerificado({
    tipo_identificacion: 'ACTA',
    base_legal_sensible: 'otra',
  });

  const resCtx = await request(app).get(`/s/${token}`).set('Accept', 'application/json');
  assert.equal(resCtx.body.dato_sensible.base_legal, 'autorizacion_expresa');
  assert.equal(resCtx.body.dato_sensible.requiere_autorizacion, true);

  const resPdf = await request(app).get(`/api/sign/${token}/document.pdf`);
  assert.equal(resPdf.status, 409, 'sin autorización expresa, el documento no se sirve');
});

// =========================================================================
// 7. MUTACION
// =========================================================================

test('8B · MUTACION: sin la puerta, el documento se serviría sin autorización', async () => {
  // La puerta es lo que hace que el aviso sea PREVIO. Sin ella (si el gate no
  // estuviera), el PDF saldría con solo el Acuerdo aceptado.
  resetDb();
  const app = makeApp();
  const { token } = await setupVerificado({ tipo_identificacion: 'ACTA' });

  const sinAutorizar = await request(app).get(`/api/sign/${token}/document.pdf`);
  assert.equal(sinAutorizar.status, 409,
    'sin la autorización, el documento NO puede servirse');

  // Y con la autorización, sí: la puerta no bloquea de más.
  await request(app)
    .post(`/api/sign/${token}/consent/sensible`)
    .send({ autoriza: true });
  const conAutorizar = await request(app).get(`/api/sign/${token}/document.pdf`);
  assert.equal(conAutorizar.status, 200);
});

test('8B · MUTACION: la clasificación no depende de que la Empresa la pida', async () => {
  // Si la inferencia por tipo no existiera, este test no encontraría ninguna
  // fila sensible: la Empresa no declaró nada.
  resetDb();
  await setupVerificado({ tipo_identificacion: 'CONSENTIMIENTO' });

  const n = db.prepare(
    'SELECT COUNT(*) AS n FROM gh_firmas_electronicas WHERE datos_sensibles = 1'
  ).get().n;
  assert.equal(n, 1, 'el tipo CONSENTIMIENTO se infiere sensible');
});

test('8B · un documento que NO es sensible no pide nada extra', async () => {
  resetDb();
  const app = makeApp();
  const { token } = await setupVerificado({ tipo_identificacion: 'REGLAMENTO' });

  const resCtx = await request(app).get(`/s/${token}`).set('Accept', 'application/json');
  assert.equal(resCtx.body.dato_sensible, null,
    'sin dato sensible no hay bloque en el contexto');

  const resPdf = await request(app).get(`/api/sign/${token}/document.pdf`);
  assert.equal(resPdf.status, 200, 'y el documento se sirve sin pedir nada extra');
});
