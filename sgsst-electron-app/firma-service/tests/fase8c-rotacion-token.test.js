/**
 * 8C · ROTACIÓN DE TOKENS (decisión D1)
 * =============================================================================
 *
 * El 3.6(e) del Acuerdo de uso promete que el token de acceso "se conserva
 * únicamente en forma de huella digital". Antes de esta fase el código no lo
 * cumplía: guardaba el token CIFRADO en `metadata._server_metadata.token_encrypted`
 * y un endpoint lo devolvía en texto claro. Cifrado sigue siendo reversible
 * con la llave: el token existía en la base en una forma recuperable.
 *
 * La salida es la ROTACIÓN: cuando la Empresa necesita el enlace otra vez, se
 * emite un token NUEVO, se guarda su HMAC y se devuelve una sola vez.
 *
 * 📦933 (23-oct-2026): la reemisión **deja sin efecto el token anterior** y no
 * hay más de un token vigente por solicitud. Es el 3.4(c) del Acuerdo v1.1:
 * "cada reemisión se registra y deja sin efecto el token anterior. No hay más
 * de un token vigente por solicitud", con la condición de código textual: "si
 * el sistema mantiene válidos los tokens anteriores, se cambia el código antes
 * de publicar". Antes la reemisión no revocaba y el tope eran 3 vivos.
 *
 * Lo que comprueban estos tests:
 *
 *   1. El token NO queda guardado de forma recuperable (y el check muerde).
 *   2. La rotación emite un token nuevo y lo devuelve una vez.
 *   3. El token anterior DEJA de funcionar: la reemisión lo invalida.
 *   4. La emisión queda auditada.
 *   5. No hay más de un token vigente por solicitud, y la invariancia se
 *      verifica después de emitir.
 *   6. `revocar_anteriores` quedó obsoleto: mandar `false` NO evita la
 *      revocación, y lo que pidió el cliente queda en la auditoría.
 *   7. La 5B cubre TODOS los tokens de la firma (el rotado también dice
 *      "vencido", no "no existe").
 *   8. El notify-remote con un token ajeno no cuela.
 *
 * Ver tests/fase8a2-supresion-datos.test.js (la 5B) y
 * tests/routes/signRequest-fase1-2-batch.test.js (el endpoint deprecado).
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const request = require('supertest');
const db = require('../src/db/connection');
const conservacion = require('../src/services/conservacion');
const supresion = require('../src/services/supresion');
const signRequestService = require('../src/services/signRequest');
const {
  resetDb, seedActiveAgreement, makeApp, createSignRequestWithIdentificacion,
  TEST_API_KEY,
} = require('./helpers');

const HEADERS = { 'X-Internal-API-Key': TEST_API_KEY };
const HORA = 3600 * 1000;

/**
 * Crea una firma y devuelve su token.
 */
async function crearFirma(extra = {}) {
  return createSignRequestWithIdentificacion({
    id_trabajador: '1234567890',
    id_empresa: '900123456',
    identificacion_numero: '1234567890',
    ...extra,
  });
}

/**
 * ¿La fila guarda el token en una forma recuperable?
 *
 * El 3.6(e) exige que el token viva solo como huella digital. Si el metadata
 * trae `_server_metadata.token_encrypted`, el token se puede descifrar: la
 * promesa no se cumple, aunque esté cifrado.
 */
function guardaTokenRecuperable(fila) {
  const crudo = JSON.stringify(fila || {});
  return typeof crudo === 'string' && crudo.includes('token_encrypted');
}

// =========================================================================
// 1. El token no queda guardado de forma recuperable
// =========================================================================

test('8C · el token NO queda guardado de forma recuperable en la base', async () => {
  resetDb();
  seedActiveAgreement();
  const { signRequest, token } = await crearFirma();

  const fila = db.prepare('SELECT * FROM gh_firmas_electronicas WHERE id = ?').get(signRequest.id);
  assert.equal(
    guardaTokenRecuperable(fila),
    false,
    'la fila no debe guardar el token cifrado: el 3.6(e) pide que viva solo como huella digital'
  );

  // El sub-objeto nuestro tampoco debe estar: `_server_metadata` era el
  // escondite del token.
  assert.ok(
    !fila.metadata || !fila.metadata.includes('_server_metadata'),
    'el metadata no debe llevar el sub-objeto _server_metadata'
  );

  // Y lo que sí debe haber: la huella (HMAC con clave secreta).
  assert.ok(fila.token_hash, 'la huella del token debe estar');
  assert.notEqual(fila.token_hash, token, 'lo guardado NO es el token, es su huella');
  assert.ok(!fila.token_hash.includes(token), 'el token en claro no puede estar en la huella');
});

test('8C · MUTACION: el detector de token recuperable muerde', async () => {
  // Si el detector no encontrara nada, el test anterior pasaría siempre. Se
  // comprueba contra una fila que SÍ tiene el token cifrado (una solicitud
  // anterior a la 8C).
  resetDb();
  seedActiveAgreement();
  const { signRequest, token } = await crearFirma();

  const cifrado = signRequestService.encryptToken(token);
  db.prepare('UPDATE gh_firmas_electronicas SET metadata = ? WHERE id = ?')
    .run(
      JSON.stringify({ _server_metadata: { token_encrypted: cifrado } }),
      signRequest.id,
    );

  const fila = db.prepare('SELECT * FROM gh_firmas_electronicas WHERE id = ?').get(signRequest.id);
  assert.equal(
    guardaTokenRecuperable(fila),
    true,
    'el detector debe encontrar el token cifrado cuando está'
  );
});

test('8C · el token queda registrado como huella en la tabla de tokens', async () => {
  resetDb();
  seedActiveAgreement();
  const { signRequest } = await crearFirma();

  const tokens = db.prepare(
    'SELECT emision, origen, expira_en FROM gh_firma_tokens WHERE firma_id = ?'
  ).all(signRequest.id);
  assert.equal(tokens.length, 1, 'debe haber un token registrado');
  assert.equal(tokens[0].emision, 1, 'el token original es la emisión 1');
  assert.equal(tokens[0].origen, 'create');
  assert.ok(tokens[0].expira_en, 'el token tiene fecha de expiración');
});

// =========================================================================
// 2. La rotación
// =========================================================================

test('8C · la rotación emite un token nuevo y lo devuelve una vez', async () => {
  resetDb();
  seedActiveAgreement();
  const app = makeApp();
  const { signRequest, token } = await crearFirma();

  const res = await request(app)
    .post(`/internal/sign-requests/${signRequest.id_solicitud}/link/rotate`)
    .set(HEADERS)
    .send({ motivo: 'La Empresa perdió la respuesta de creación' });

  assert.equal(res.status, 200);
  assert.equal(res.body.id_solicitud, signRequest.id_solicitud);
  assert.ok(res.body.token, 'debe devolver el token');
  assert.notEqual(res.body.token, token, 'el token nuevo es distinto del original');
  assert.ok(res.body.url_publica.endsWith(`/s/${res.body.token}`));
  assert.equal(res.body.qr_payload, res.body.url_publica);
  assert.equal(res.body.emision, 2, 'la segunda emisión');
  assert.equal(res.body.estado, 'PENDING');

  // Y queda registrado, con su motivo.
  const fila = db.prepare(
    'SELECT emision, origen, token_hash FROM gh_firma_tokens WHERE firma_id = ? AND emision = 2'
  ).get(signRequest.id);
  assert.ok(fila, 'el token emitido queda registrado');
  assert.equal(fila.origen, 'rotate');
  assert.notEqual(fila.token_hash, res.body.token, 'lo guardado es la huella, no el token');
});

test('8C · el token anterior DEJA de funcionar: la reemisión lo invalida', async () => {
  resetDb();
  seedActiveAgreement();
  const app = makeApp();
  const { signRequest, token } = await crearFirma();

  await request(app)
    .post(`/internal/sign-requests/${signRequest.id_solicitud}/link/rotate`)
    .set(HEADERS)
    .send({});

  // El enlace original deja de servir: el 3.4(c) ordena que cada reemisión
  // deje sin efecto el token anterior y que no haya más de un token vigente.
  const res = await request(app).get(`/api/sign/${token}/verify`);
  assert.equal(res.status, 404, 'el token anterior no debe resolver');
  assert.equal(res.body.error.code, 'TOKEN_NOT_FOUND');

  // Y el nuevo sí.
  const rotado = await request(app)
    .post(`/internal/sign-requests/${signRequest.id_solicitud}/link/rotate`)
    .set(HEADERS)
    .send({});
  const res2 = await request(app).get(`/api/sign/${rotado.body.token}/verify`);
  assert.equal(res2.status, 200, 'el token rotado debe resolver');
});

test('8C · la emisión queda auditada', async () => {
  resetDb();
  seedActiveAgreement();
  const app = makeApp();
  const { signRequest } = await crearFirma();

  await request(app)
    .post(`/internal/sign-requests/${signRequest.id_solicitud}/link/rotate`)
    .set(HEADERS)
    .send({ motivo: 'Reenvío de la invitación' });

  const eventos = db.prepare(`
    SELECT evento, id_actor, metadata FROM gh_firma_eventos
    WHERE firma_id = ? AND evento = 'LINK_ROTATED'
  `).all(signRequest.id);
  assert.equal(eventos.length, 1, 'debe haber exactamente 1 evento LINK_ROTATED');
  assert.match(eventos[0].id_actor, /^rh:/, 'el actor debe quedar registrado');
  const meta = JSON.parse(eventos[0].metadata);
  assert.equal(meta.emision, 2);
});

// =========================================================================
// 3. El tope de tokens vivos
// =========================================================================

test('8C · no hay más de un token vigente por solicitud (el 3.4(c))', async () => {
  assert.equal(signRequestService.MAX_TOKENS_VIGENTES, 1,
    'el 3.4(c): no hay más de un token vigente por solicitud');

  resetDb();
  seedActiveAgreement();
  const app = makeApp();
  const { signRequest } = await crearFirma();

  // El original cuenta. Cada reemisión deja sin efecto el anterior.
  const r2 = await request(app)
    .post(`/internal/sign-requests/${signRequest.id_solicitud}/link/rotate`)
    .set(HEADERS).send({});
  assert.equal(r2.status, 200);
  assert.deepEqual(r2.body.revocados, [1],
    'la reemisión deja sin efecto el token anterior');
  assert.equal(r2.body.tokens_activos, 1);

  const r3 = await request(app)
    .post(`/internal/sign-requests/${signRequest.id_solicitud}/link/rotate`)
    .set(HEADERS).send({});
  assert.equal(r3.status, 200);
  assert.deepEqual(r3.body.revocados, [2]);
  assert.equal(r3.body.tokens_activos, 1);

  // Y las siguientes también: la reemisión no se bloquea, invalida.
  const r4 = await request(app)
    .post(`/internal/sign-requests/${signRequest.id_solicitud}/link/rotate`)
    .set(HEADERS).send({});
  assert.equal(r4.status, 200);
  assert.equal(r4.body.tokens_activos, 1);

  // En cualquier momento hay UNO solo vigente.
  const vivos = db.prepare(
    'SELECT COUNT(*) AS n FROM gh_firma_tokens WHERE firma_id = ? AND revocado_at IS NULL'
  ).get(signRequest.id).n;
  assert.equal(vivos, 1, 'un solo token vigente por solicitud');

  // Y todos quedan registrados: uno vivo, los demás revocados.
  const todos = db.prepare(
    'SELECT emision, revocado_at FROM gh_firma_tokens WHERE firma_id = ? ORDER BY emision'
  ).all(signRequest.id);
  assert.equal(todos.length, 4, 'las cuatro emisiones quedan en el registro');
  assert.equal(todos.filter((t) => t.revocado_at === null).length, 1);
});

test('8C · la reemisión deja sin efecto el token anterior y emite uno nuevo', async () => {
  resetDb();
  seedActiveAgreement();
  const app = makeApp();
  const { signRequest, token } = await crearFirma();

  const res = await request(app)
    .post(`/internal/sign-requests/${signRequest.id_solicitud}/link/rotate`)
    .set(HEADERS)
    .send({ motivo: 'Se perdió el control del enlace' });

  assert.equal(res.status, 200);
  assert.deepEqual(res.body.revocados, [1], 'el token original queda revocado');

  // El enlace viejo ya no resuelve.
  const resViejo = await request(app).get(`/api/sign/${token}/verify`);
  assert.equal(resViejo.status, 404, 'un token revocado no debe resolver');
  assert.equal(resViejo.body.error.code, 'TOKEN_NOT_FOUND');

  // Y el nuevo sí.
  const resNuevo = await request(app).get(`/api/sign/${res.body.token}/verify`);
  assert.equal(resNuevo.status, 200);

  // La revocación queda registrada con su motivo.
  const fila = db.prepare(
    'SELECT revocado_at, revocado_por, motivo_revocacion FROM gh_firma_tokens WHERE firma_id = ? AND emision = 1'
  ).get(signRequest.id);
  assert.ok(fila.revocado_at, 'debe quedar revocada');
  assert.match(fila.revocado_por, /^rh:/);
  assert.equal(fila.motivo_revocacion, 'Se perdió el control del enlace');
});

test('8C · revocar_anteriores: false NO evita la revocación (el 3.4(c))', async () => {
  resetDb();
  seedActiveAgreement();
  const app = makeApp();
  const { signRequest, token } = await crearFirma();

  const res = await request(app)
    .post(`/internal/sign-requests/${signRequest.id_solicitud}/link/rotate`)
    .set(HEADERS)
    .send({ revocar_anteriores: false });

  assert.equal(res.status, 200);
  assert.deepEqual(res.body.revocados, [1],
    'el campo obsoleto no abre la puerta: la reemisión invalida siempre');

  const resViejo = await request(app).get(`/api/sign/${token}/verify`);
  assert.equal(resViejo.status, 404);

  // Queda en el registro de auditoría lo que pidió el cliente.
  const eventos = db.prepare(`
    SELECT metadata FROM gh_firma_eventos
    WHERE firma_id = ? AND evento = 'LINK_ROTATED'
  `).all(signRequest.id);
  const meta = JSON.parse(eventos[0].metadata);
  assert.equal(meta.revoco_anteriores, true, 'la reemisión revocó');
  assert.equal(meta.revocar_anteriores_pedido, false, 'queda lo que pidió el cliente');
});

// =========================================================================
// 4. El endpoint deprecado
// =========================================================================

test('8C · GET /link ya no recupera el token: dice que hay que rotar', async () => {
  resetDb();
  seedActiveAgreement();
  const app = makeApp();
  const { signRequest } = await crearFirma();

  const res = await request(app)
    .get(`/internal/sign-requests/${signRequest.id_solicitud}/link`)
    .set(HEADERS);

  assert.equal(res.status, 410);
  assert.equal(res.body.error.code, 'LINK_NOT_AVAILABLE');
  assert.equal(res.body.error.details.reason, 'rotacion_requerida');
  assert.equal(
    res.body.error.details.rotacion_endpoint,
    'POST /internal/sign-requests/:id/link/rotate'
  );
});

// =========================================================================
// 5. La 5B cubre todos los tokens
// =========================================================================

test('8C · tras la supresión, el enlace ROTADO también dice "vencido"', async () => {
  resetDb();
  seedActiveAgreement();
  const app = makeApp();
  const { signRequest, token } = await crearFirma();

  // Se rotura el enlace (el que la Empresa tiene, por ejemplo, en el QR).
  const rotado = await request(app)
    .post(`/internal/sign-requests/${signRequest.id_solicitud}/link/rotate`)
    .set(HEADERS).send({});
  assert.equal(rotado.status, 200);

  // La firma vence por conservación y se suprime (la 5B).
  const ahora = Date.now();
  db.prepare(`
    UPDATE gh_firmas_electronicas
       SET estado = 'SIGNED',
           fecha_firma = ?,
           fecha_conservacion = ?,
           fecha_expiracion = ?
     WHERE id = ?
  `).run(
    new Date(ahora).toISOString(),
    new Date(ahora - 24 * HORA).toISOString(), // vencida ayer
    new Date(ahora + 48 * HORA).toISOString(),
    signRequest.id
  );

  conservacion.abrirVentana({ actor: 'test', motivo: 'Vencimiento del plazo declarado', minutos: 15 });
  conservacion.armarLote({ actor: 'test', motivo: 'Vencimiento del plazo declarado' });
  supresion.suprimir({ actor: 'test', motivo: 'Vencimiento del plazo declarado', dryRun: false });

  // El enlace original dice "vencido"...
  const res1 = await request(app).get(`/api/sign/${token}/verify`);
  assert.equal(res1.status, 410);
  assert.equal(res1.body.error.code, 'CONSERVACION_VENCIDA');

  // ...y el rotado TAMBIÉN. Dos respuestas distintas para el mismo hecho
  // dependerían de por dónde se entrara, y eso es una fuga de información
  // sobre lo que pasó con la firma.
  const res2 = await request(app).get(`/api/sign/${rotado.body.token}/verify`);
  assert.equal(res2.status, 410);
  assert.equal(res2.body.error.code, 'CONSERVACION_VENCIDA');
});

// =========================================================================
// 6. El notify-remote no acepta un token ajeno
// =========================================================================

test('8C · el notify-remote rechaza un token de otra solicitud', async () => {
  resetDb();
  seedActiveAgreement();
  const app = makeApp();
  const { signRequest } = await crearFirma();
  const otra = await crearFirma({ id_trabajador: '9876543210', identificacion_numero: '9876543210' });

  const res = await request(app)
    .post(`/internal/sign-requests/${signRequest.id_solicitud}/notify-remote`)
    .set(HEADERS)
    .send({ correo: 'user@example.com', token: otra.token });

  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'TOKEN_MISMATCH');
});

test('8C · el notify-remote con el token propio NO emite otro token', async () => {
  resetDb();
  seedActiveAgreement();
  const app = makeApp();
  const { signRequest, token } = await crearFirma();

  const res = await request(app)
    .post(`/internal/sign-requests/${signRequest.id_solicitud}/notify-remote`)
    .set(HEADERS)
    .send({ correo: 'user@example.com', token });

  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);

  // Solo hay un token: el original. No se gastó un cupo de rotación.
  const n = db.prepare(
    'SELECT COUNT(*) AS n FROM gh_firma_tokens WHERE firma_id = ?'
  ).get(signRequest.id).n;
  assert.equal(n, 1, 'con el token propio no se emite otro');
});
