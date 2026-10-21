/**
 * Tests de la Fase 8A.1 — el vencimiento del plazo de conservación.
 *
 * EL DEFECTO QUE ESTA FASE CORRIGE
 * ---------------------------------
 * La verificación pública (`GET /api/sign/:token/verify`) resolvía el token
 * con `skipExpirationCheck`, una bandera que se saltaba TODAS las
 * comprobaciones de vencimiento. El efecto: vencido el plazo de conservación
 * que declaró la empresa (numeral 10.6 del Acuerdo), el sistema seguía
 * respondiendo "firma registrada y documento íntegro", recalculando el
 * SHA-256 del PDF y pintando el banner verde. Afirmaba una vigencia que ya
 * no existía.
 *
 * AHORA HAY TRES ESTADOS DISTINTOS
 * ---------------------------------
 *   1. Token válido, plazo de conservación VENCIDO y sin deber legal de
 *      conservación → 410 CONSERVACION_VENCIDA. El mensaje es "no disponible
 *      por vencimiento del plazo": no "inválido" (mentiría sobre el motivo) y
 *      no "firma válida" (afirmaría una vigencia que ya no existe).
 *   2. Token válido, plazo de conservación VENCIDO pero con HOLD legal →
 *      200. El deber legal de conservación prima: el dato no se suprime, la
 *      evidencia sigue viva y la verificación debe seguir confirmando.
 *   3. Token válido, plazo vigente, aunque la VENTANA PARA FIRMAR ya haya
 *      vencido → 200. La operación histórica (consultar lo que ya se firmó)
 *      no se bloquea por un TTL: son cosas distintas.
 *
 * Y el 404 ya no confirma la existencia: la misma respuesta para un token
 * que nunca existió y para uno que ya no se puede mostrar.
 *
 * Cubre:
 * - /verify con plazo vencido → 410 CONSERVACION_VENCIDA
 * - /verify con plazo vencido + hold legal → 200 (el hold prima)
 * - /verify con plazo vencido + el enlace (ventana para firmar) vencido → 410
 * - /verify con plazo vigente pero enlace vencido → 200 (operación histórica)
 * - /verify con plazo vigente → 200 (sin regresión)
 * - El enlace /s/:token con plazo vencido → 410 CONSERVACION_VENCIDA
 * - verify-pdf con plazo vencido → 410 CONSERVACION_VENCIDA
 * - Token inexistente → 404 con mensaje "No disponible" (no confirma)
 * - La mini-app no afirma "documento íntegro" cuando el plazo venció
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const fs = require('node:fs');
const path = require('node:path');
const db = require('../src/db/connection');
const {
  resetDb, makeApp, createSignRequestWithIdentificacion,
} = require('./helpers');

const WEB_DIR = path.join(__dirname, '..', 'web', 'firma');

const HORA = 3600 * 1000;

/**
 * Deja una solicitud en estado SIGNED con la fecha de conservación que se le
 * pida.
 *
 * El estado SIGNED se fuerza en la base a propósito: lo que esta fase
 * prueba es el comportamiento del sistema frente al VENCIMIENTO, no el
 * recorrido del flujo de firma (que ya tiene sus propios tests).
 *
 * @param {object} opts
 * @param {number|null} opts.conservacion - días hacia el futuro (negativo = vencida)
 * @param {number|null} opts.vencimientoEnlace - horas hacia el futuro del TTL del enlace
 * @param {boolean} opts.hold - poner deber legal de conservación
 */
async function setupFirmada({
  conservacion = null,
  vencimientoEnlace = 48,
  hold = false,
} = {}) {
  const { token, signRequest } = await createSignRequestWithIdentificacion({
    id_trabajador: '1234567890',
    id_empresa: '900123456',
    identificacion_numero: '1234567890',
  });

  const ahora = Date.now();
  const fechaConservacion = conservacion === null
    ? null
    : new Date(ahora + conservacion * 24 * HORA).toISOString();
  const fechaExpiracion = new Date(
    ahora + (vencimientoEnlace === null ? 48 : vencimientoEnlace) * HORA
  ).toISOString();

  db.prepare(`
    UPDATE gh_firmas_electronicas
       SET estado = 'SIGNED',
           fecha_firma = ?,
           fecha_conservacion = ?,
           fecha_expiracion = ?,
           hold_legal = ?,
           motivo_hold = ?
     WHERE id = ?
  `).run(
    new Date(ahora).toISOString(),
    fechaConservacion,
    fechaExpiracion,
    hold ? 1 : 0,
    hold ? 'Reclamación en curso' : null,
    signRequest.id
  );

  return { token, signRequest };
}

// =========================================================================
// 1. El estado vencido: 410 CONSERVACION_VENCIDA
// =========================================================================

test('8A.1 · /verify con el plazo de conservación vencido → 410 CONSERVACION_VENCIDA', async () => {
  resetDb();
  const { token } = await setupFirmada({ conservacion: -1 });

  const app = makeApp();
  const res = await request(app).get(`/api/sign/${token}/verify`);

  assert.equal(res.status, 410);
  assert.equal(res.body.error.code, 'CONSERVACION_VENCIDA');
  assert.match(res.body.error.message, /vencimiento del plazo/i);
  // No se afirma que la firma esté vigente ni se llama "inválido".
  assert.doesNotMatch(JSON.stringify(res.body), /integro|íntegro|válida|inválido/i);
});

test('8A.1 · /s/:token con el plazo de conservación vencido → 410 CONSERVACION_VENCIDA', async () => {
  resetDb();
  const { token } = await setupFirmada({ conservacion: -1 });

  const app = makeApp();
  const res = await request(app).get(`/s/${token}`).set('Accept', 'application/json');

  assert.equal(res.status, 410);
  assert.equal(res.body.error.code, 'CONSERVACION_VENCIDA');
});

test('8A.1 · verify-pdf con el plazo de conservación vencido → 410 CONSERVACION_VENCIDA', async () => {
  resetDb();
  const { token } = await setupFirmada({ conservacion: -1 });

  const app = makeApp();
  const res = await request(app)
    .post(`/api/sign/${token}/verify-pdf`)
    .send({ pdf_base64: Buffer.from('%PDF-1.4\n%%EOF\n').toString('base64') });

  assert.equal(res.status, 410);
  assert.equal(res.body.error.code, 'CONSERVACION_VENCIDA');
});

// =========================================================================
// 2. El hold legal prima sobre el vencimiento
// =========================================================================

test('8A.1 · /verify con plazo vencido PERO hold legal → 200 (el dato se conserva)', async () => {
  resetDb();
  const { token } = await setupFirmada({ conservacion: -1, hold: true });

  const app = makeApp();
  const res = await request(app).get(`/api/sign/${token}/verify`);

  // El deber legal de conservación prima: el dato no se suprime, la evidencia
  // sigue viva y la verificación debe seguir respondiendo.
  assert.equal(res.status, 200);
  assert.equal(res.body.estado, 'SIGNED');
});

// =========================================================================
// 3. El vencimiento del ENLACE y el del PLAZO son cosas distintas
// =========================================================================

test('8A.1 · /verify con la ventana para firmar vencida pero plazo vigente → 200', async () => {
  resetDb();
  const { token } = await setupFirmada({ conservacion: 365, vencimientoEnlace: -48 });

  const app = makeApp();
  const res = await request(app).get(`/api/sign/${token}/verify`);

  // La consulta histórica es de solo lectura: consultar lo que ya se firmó
  // no puede depender de que la ventana para firmar siga abierta.
  assert.equal(res.status, 200);
  assert.equal(res.body.estado, 'SIGNED');
});

test('8A.1 · /verify con plazo vencido y enlace vencido → 410 (manda el plazo)', async () => {
  resetDb();
  const { token } = await setupFirmada({ conservacion: -1, vencimientoEnlace: -48 });

  const app = makeApp();
  const res = await request(app).get(`/api/sign/${token}/verify`);

  assert.equal(res.status, 410);
  assert.equal(res.body.error.code, 'CONSERVACION_VENCIDA');
});

// =========================================================================
// 4. Sin regresión: el caso normal sigue funcionando
// =========================================================================

test('8A.1 · /verify con plazo vigente → 200 (sin regresión)', async () => {
  resetDb();
  const { token } = await setupFirmada({ conservacion: 365 });

  const app = makeApp();
  const res = await request(app).get(`/api/sign/${token}/verify`);

  assert.equal(res.status, 200);
  assert.equal(res.body.estado, 'SIGNED');
  assert.ok(res.body.id_solicitud, 'debe traer el id de solicitud');
});

test('8A.1 · /verify sin plazo declarado (fecha_conservacion NULL) → 200 (no se inventa plazo)', async () => {
  resetDb();
  const { token } = await setupFirmada({ conservacion: null });

  const app = makeApp();
  const res = await request(app).get(`/api/sign/${token}/verify`);

  // El 8.6 dice que el Acuerdo no fija plazo propio: si la empresa no declaró
  // uno, no hay vencimiento y no hay purga.
  assert.equal(res.status, 200);
});

// =========================================================================
// 5. El 404 no confirma la existencia
// =========================================================================

test('8A.1 · token inexistente → 404 con mensaje "No disponible" (no afirma existencia)', async () => {
  resetDb();
  await setupFirmada({ conservacion: 365 });

  const app = makeApp();
  const res = await request(app).get('/api/sign/token-que-no-existe/verify');

  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'TOKEN_NOT_FOUND');
  assert.equal(res.body.error.message, 'No disponible');
  // No se dice "no existe" ni se da por hecho que el enlace se copió mal.
  assert.doesNotMatch(res.body.error.message, /no existe|no encontramos/i);
});

// =========================================================================
// 6. La mini-app
// =========================================================================

test('8A.1 · la mini-app maneja CONSERVACION_VENCIDA en el enlace y en la verificación', () => {
  const appJs = fs.readFileSync(path.join(WEB_DIR, 'app.js'), 'utf8');

  // El enlace (carga del contexto): mensaje propio y sin verificación.
  assert.match(
    appJs,
    /err\.code === 'CONSERVACION_VENCIDA'/,
    'la mini-app debe reconocer el código CONSERVACION_VENCIDA'
  );
  assert.match(
    appJs,
    /No está disponible por vencimiento del plazo/,
    'la mini-app debe explicar que lo vence es el plazo de conservación'
  );

  // La pantalla de verificación: mensaje propio, no el genérico.
  const bloqueVerify = appJs.slice(
    appJs.indexOf('function showVerifyScreen'),
    appJs.indexOf('function renderVerifyContext')
  );
  assert.match(
    bloqueVerify,
    /CONSERVACION_VENCIDA/,
    'la pantalla de verificación debe distinguir el vencimiento del plazo'
  );
  assert.match(
    bloqueVerify,
    /No disponible por vencimiento del plazo/,
    'la pantalla de verificación debe decirlo con esas palabras'
  );

  // La verificación no se ofrece cuando el plazo venció: sería una promesa
  // falsa, porque la verificación responde lo mismo.
  assert.match(
    appJs,
    /CONSERVACION_VENCIDA[\s\S]{0,400}allowVerify: false/,
    'no se debe ofrecer verificación cuando el plazo de conservación venció'
  );
});

test('8A.1 · el backend no se salta el vencimiento con ninguna bandera', () => {
  const publicFlow = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'services', 'publicFlow.js'), 'utf8'
  );

  // La bandera vieja se saltaba TODO. Ya no debe existir como bandera: no
  // puede quedar ningún `skipExpirationCheck:` ni `opts.skipExpirationCheck`.
  // (Mencionarla en un comentario que explique la historia sí es correcto.)
  assert.doesNotMatch(
    publicFlow,
    /skipExpirationCheck\s*[:)]/,
    'skipExpirationCheck no debe seguir usándose como bandera: se saltaba el vencimiento'
  );
  assert.doesNotMatch(
    publicFlow,
    /opts\s*\.\s*skipExpirationCheck/,
    'ningún call site debe pasar skipExpirationCheck'
  );

  // Y la bandera nueva no puede saltarse el plazo: el chequeo va ANTES del
  // retorno de la operación histórica.
  const iCheck = publicFlow.indexOf('vencidaPorConservacion(signRequest)');
  const iHistorico = publicFlow.indexOf('opts.permitirHistorico');
  assert.ok(iCheck > -1, 'debe existir el chequeo de vencimiento por conservación');
  assert.ok(iHistorico > -1, 'debe existir la operación histórica');
  assert.ok(
    iCheck < iHistorico,
    'el chequeo de vencimiento debe ir ANTES del retorno de la operación histórica'
  );
});
