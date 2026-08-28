/**
 * Tests de FASE 3 · A1.5.4-B: expiración de consentimientos.
 *
 * Cubre:
 * - OTP vencido (fecha_otp_enviado + TTL < now) → transición a EXPIRED
 *   vía verifyOtp() (camino automático, no requiere acción admin)
 * - EXPIRED permite crear un nuevo consentimiento para la misma key
 * - POST /internal/consentimientos/:id/expire (admin):
 *   - requiere X-Admin-API-Key (401 sin auth)
 *   - requiere motivo (400 si < 10 chars)
 *   - requiere actor (400 si vacío)
 *   - rechaza estados terminales (409 CONSENT_EXPIRE_NOT_ALLOWED)
 *   - estado válido (OTP_PENDING, OTP_LOCKED) → 200 con estado EXPIRED
 *   - idempotencia: si ya está EXPIRED → 200 con already_expired=true
 *   - registra evento CONSENT_EXPIRED en gh_consentimientos_eventos
 *   - no modifica correo_verificacion ni otros datos históricos
 *
 * Ver C:\Temp\firma-fase3-design.md (este commit) y API.md §6.12.
 */
'use strict';

// Ensure test env before any requires (dotenv may set production from .env)
if (process.env.NODE_ENV !== 'test') process.env.NODE_ENV = 'test';
delete require.cache[require.resolve('../../src/config')];

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const db = require('../../src/db/connection');
const {
  resetDb, seedActiveAgreement, makeApp, TEST_API_KEY, TEST_ADMIN_API_KEY,
} = require('../helpers');

const HEADERS = { 'X-Internal-API-Key': TEST_API_KEY };
const ADMIN_HEADERS = { 'X-Admin-API-Key': TEST_ADMIN_API_KEY };

// =========================================================================
// Helpers
// =========================================================================

/**
 * Crea un consentimiento vía API. Helper para simplificar los tests.
 * Retorna { consent_id, devOtp, body }.
 */
async function createConsent({
  id_trabajador = '111',
  id_empresa = '222',
  version_acuerdo = 'v1.0',
  correo = 'a@b.com',
  kair_version = '0.1.189',
} = {}) {
  const app = makeApp();
  const res = await request(app)
    .post('/internal/consentimientos')
    .set(HEADERS)
    .send({
      id_trabajador, id_empresa, version_acuerdo,
      correo_verificacion: correo, kair_version,
    });
  if (res.status !== 201) {
    throw new Error(`createConsent: status=${res.status} body=${JSON.stringify(res.body)}`);
  }
  return {
    consent_id: res.body.consent_id,
    devOtp: res.body.devOtp,
    body: res.body,
  };
}

/**
 * Fuerce un estado de "OTP vencido" haciendo UPDATE de fecha_otp_enviado
 * a un timestamp muy pasado (1 hora atrás, suficiente para cualquier TTL).
 */
function forceOtpExpired(consentId) {
  db.prepare(`
    UPDATE gh_consentimientos_firma
    SET fecha_otp_enviado = datetime('now', '-1 hour')
    WHERE id = ?
  `).run(consentId);
}

// =========================================================================
// OTP vencido → EXPIRED (camino automático, vía verifyOtp)
// =========================================================================

test('verifyOtp: OTP vencido → 422 OTP_EXPIRED + estado EXPIRED + evento registrado', async () => {
  resetDb();
  seedActiveAgreement();
  const { consent_id, devOtp } = await createConsent();

  forceOtpExpired(consent_id);

  // Verificar que el OTP original es el correcto: el problema NO es que
  // el OTP sea incorrecto, es que YA VENCIÓ.
  const app = makeApp();
  const r = await request(app)
    .post(`/internal/consentimientos/${consent_id}/verify-otp`)
    .set(HEADERS)
    .send({ otp: devOtp });

  assert.equal(r.status, 422);
  assert.equal(r.body.error.code, 'OTP_EXPIRED');
  assert.equal(r.body.error.details.consent_id, consent_id);

  // Verificar estado en BD
  const row = db.prepare(
    'SELECT estado, manifestacion_aceptada FROM gh_consentimientos_firma WHERE id = ?'
  ).get(consent_id);
  assert.equal(row.estado, 'EXPIRED');
  assert.equal(row.manifestacion_aceptada, 0);

  // Verificar que se registró el evento
  const ev = db.prepare(
    "SELECT evento, id_actor, metadata FROM gh_consentimientos_eventos WHERE consent_id = ? AND evento = 'CONSENT_EXPIRED'"
  ).get(consent_id);
  assert.ok(ev, 'debe existir un evento CONSENT_EXPIRED');
  assert.equal(ev.id_actor, 'sistema:otp-expiry');
  const meta = JSON.parse(ev.metadata);
  assert.equal(meta.motivo, 'otp_expired');
  assert.ok(meta.fecha_otp_enviado, 'metadata debe tener fecha_otp_enviado original');
  assert.ok(meta.ttl_seconds, 'metadata debe tener ttl_seconds');
});

test('verifyOtp: OTP NO vencido (fecha_otp_enviado reciente) → comportamiento normal (ACCEPTED)', async () => {
  // Caso de control: si el OTP NO está vencido, verifyOtp NO debe
  // aplicar la rama de expiración.
  resetDb();
  seedActiveAgreement();
  const { consent_id, devOtp } = await createConsent();

  // fecha_otp_enviado es reciente (recién creado), OTP_TTL_SECONDS=600 → 10 min
  // NO forzamos expiración: el consentimiento tiene fecha_otp_enviado = now.

  const app = makeApp();
  const r = await request(app)
    .post(`/internal/consentimientos/${consent_id}/verify-otp`)
    .set(HEADERS)
    .send({ otp: devOtp });
  assert.equal(r.status, 200);
  assert.equal(r.body.manifestacion_aceptada, true);
  assert.equal(r.body.estado, 'ACCEPTED');
});

test('create: EXPIRED permite crear un nuevo consentimiento para la misma key', async () => {
  // Caso real: consent_id=2 quedó EXPIRED (FASE 1). Sin este fix,
  // intentar crear un nuevo consentimiento para la misma key
  // (trabajador, empresa, version) retorna 409 CONSENT_PENDING
  // porque el service solo verificaba manifestacion_aceptada.
  // Tras el fix, EXPIRED no bloquea (terminal pero ≠ alreadyAccepted).
  resetDb();
  seedActiveAgreement();
  const { consent_id, devOtp } = await createConsent({
    id_trabajador: '999',
    id_empresa: '888',
    correo: 'first@example.com',
  });
  forceOtpExpired(consent_id);
  const app = makeApp();
  await request(app)
    .post(`/internal/consentimientos/${consent_id}/verify-otp`)
    .set(HEADERS)
    .send({ otp: devOtp });
  // Ahora consent está en EXPIRED. Crear uno nuevo para misma key.
  const r2 = await request(app)
    .post('/internal/consentimientos')
    .set(HEADERS)
    .send({
      id_trabajador: '999',
      id_empresa: '888',
      version_acuerdo: 'v1.0',
      correo_verificacion: 'second@example.com',
      kair_version: '0.1.189',
    });
  assert.equal(r2.status, 201, 'EXPIRED no debe bloquear un nuevo consent');
  assert.notEqual(r2.body.consent_id, consent_id);
  assert.equal(r2.body.estado, 'OTP_PENDING');
});

// =========================================================================
// POST /internal/consentimientos/:id/expire (admin)
// =========================================================================

test('POST /expire: sin X-Admin-API-Key → 401 INVALID_API_KEY', async () => {
  resetDb();
  seedActiveAgreement();
  const { consent_id } = await createConsent();

  const app = makeApp();
  const r = await request(app)
    .post(`/internal/consentimientos/${consent_id}/expire`)
    .send({ motivo: 'liberar key bloqueada por typo en correo', actor: 'admin-test' });

  assert.equal(r.status, 401);
  assert.equal(r.body.error.code, 'INVALID_API_KEY');
});

test('POST /expire: con X-Admin-API-Key incorrecto → 401 INVALID_API_KEY', async () => {
  resetDb();
  seedActiveAgreement();
  const { consent_id } = await createConsent();

  const app = makeApp();
  const r = await request(app)
    .post(`/internal/consentimientos/${consent_id}/expire`)
    .set('X-Admin-API-Key', 'wrong-key-32-bytes-minimum-required!')
    .send({ motivo: 'liberar key bloqueada por typo en correo', actor: 'admin-test' });

  assert.equal(r.status, 401);
  assert.equal(r.body.error.code, 'INVALID_API_KEY');
});

test('POST /expire: motivo muy corto (< 10 chars) → 400 INVALID_REQUEST_BODY', async () => {
  resetDb();
  seedActiveAgreement();
  const { consent_id } = await createConsent();

  const app = makeApp();
  const r = await request(app)
    .post(`/internal/consentimientos/${consent_id}/expire`)
    .set(ADMIN_HEADERS)
    .send({ motivo: 'corto', actor: 'admin-test' });

  assert.equal(r.status, 400);
  assert.equal(r.body.error.code, 'INVALID_REQUEST_BODY');
});

test('POST /expire: motivo solo espacios → 400 INVALID_REQUEST_BODY', async () => {
  resetDb();
  seedActiveAgreement();
  const { consent_id } = await createConsent();

  const app = makeApp();
  const r = await request(app)
    .post(`/internal/consentimientos/${consent_id}/expire`)
    .set(ADMIN_HEADERS)
    .send({ motivo: '          ', actor: 'admin-test' });

  assert.equal(r.status, 400);
  assert.equal(r.body.error.code, 'INVALID_REQUEST_BODY');
});

test('POST /expire: actor vacío → 400 INVALID_REQUEST_BODY', async () => {
  resetDb();
  seedActiveAgreement();
  const { consent_id } = await createConsent();

  const app = makeApp();
  const r = await request(app)
    .post(`/internal/consentimientos/${consent_id}/expire`)
    .set(ADMIN_HEADERS)
    .send({ motivo: 'liberar key bloqueada por typo en correo', actor: '' });

  assert.equal(r.status, 400);
  assert.equal(r.body.error.code, 'INVALID_REQUEST_BODY');
});

test('POST /expire: id no numérico → 400 INVALID_REQUEST_BODY', async () => {
  resetDb();
  const app = makeApp();
  const r = await request(app)
    .post('/internal/consentimientos/abc/expire')
    .set(ADMIN_HEADERS)
    .send({ motivo: 'liberar key bloqueada por typo en correo', actor: 'admin-test' });

  assert.equal(r.status, 400);
  assert.equal(r.body.error.code, 'INVALID_REQUEST_BODY');
});

test('POST /expire: consent inexistente → 404 CONSENT_NOT_FOUND', async () => {
  resetDb();
  const app = makeApp();
  const r = await request(app)
    .post('/internal/consentimientos/99999/expire')
    .set(ADMIN_HEADERS)
    .send({ motivo: 'liberar key bloqueada por typo en correo', actor: 'admin-test' });

  assert.equal(r.status, 404);
  assert.equal(r.body.error.code, 'CONSENT_NOT_FOUND');
});

test('POST /expire: estado OTP_PENDING → 200, estado EXPIRED, evento registrado', async () => {
  resetDb();
  seedActiveAgreement();
  const { consent_id } = await createConsent({
    id_trabajador: '100',
    id_empresa: '200',
    correo: 'original@example.com',
  });

  const app = makeApp();
  const r = await request(app)
    .post(`/internal/consentimientos/${consent_id}/expire`)
    .set(ADMIN_HEADERS)
    .send({
      motivo: 'liberar key bloqueada por typo en correo del firmante',
      actor: 'admin-test',
    });

  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.equal(r.body.consent_id, consent_id);
  assert.equal(r.body.estado, 'EXPIRED');
  assert.equal(r.body.estado_anterior, 'OTP_PENDING');
  assert.equal(r.body.actor, 'admin-test');
  assert.ok(r.body.fecha_expiracion);
  assert.equal(r.body.already_expired, undefined);  // No fue idempotente

  // Verificar BD
  const row = db.prepare(
    'SELECT estado, correo_verificacion, manifestacion_aceptada FROM gh_consentimientos_firma WHERE id = ?'
  ).get(consent_id);
  assert.equal(row.estado, 'EXPIRED');
  // No se modificó el correo (preservación histórica)
  assert.equal(row.correo_verificacion, 'original@example.com');
  assert.equal(row.manifestacion_aceptada, 0);

  // Verificar evento
  const ev = db.prepare(
    "SELECT id_actor, metadata FROM gh_consentimientos_eventos WHERE consent_id = ? AND evento = 'CONSENT_EXPIRED'"
  ).get(consent_id);
  assert.ok(ev, 'debe existir evento CONSENT_EXPIRED');
  assert.equal(ev.id_actor, 'admin:admin-test');
  const meta = JSON.parse(ev.metadata);
  assert.equal(meta.motivo, 'liberar key bloqueada por typo en correo del firmante');
  assert.equal(meta.actor, 'admin-test');
  assert.equal(meta.estado_anterior, 'OTP_PENDING');
  assert.equal(meta.source, 'admin-endpoint');
});

test('POST /expire: estado OTP_LOCKED → 200, estado EXPIRED', async () => {
  // OTP_LOCKED también es expirable (no es terminal).
  resetDb();
  seedActiveAgreement();
  const { consent_id } = await createConsent();
  // Forzar LOCKED con 5 intentos incorrectos
  const app = makeApp();
  for (let i = 0; i < 5; i++) {
    await request(app)
      .post(`/internal/consentimientos/${consent_id}/verify-otp`)
      .set(HEADERS)
      .send({ otp: '000000' });
  }
  // Verificar que está LOCKED
  const before = db.prepare('SELECT estado FROM gh_consentimientos_firma WHERE id = ?').get(consent_id);
  assert.equal(before.estado, 'OTP_LOCKED');

  const r = await request(app)
    .post(`/internal/consentimientos/${consent_id}/expire`)
    .set(ADMIN_HEADERS)
    .send({
      motivo: 'liberar key bloqueada por demasiados intentos fallidos',
      actor: 'admin-test',
    });
  assert.equal(r.status, 200);
  assert.equal(r.body.estado, 'EXPIRED');
  assert.equal(r.body.estado_anterior, 'OTP_LOCKED');
});

test('POST /expire: estado ACCEPTED → 409 CONSENT_EXPIRE_NOT_ALLOWED', async () => {
  // No se puede expirar un consentimiento ya aceptado (cadena legal rota).
  resetDb();
  seedActiveAgreement();
  const { consent_id, devOtp } = await createConsent();
  const app = makeApp();
  await request(app)
    .post(`/internal/consentimientos/${consent_id}/verify-otp`)
    .set(HEADERS)
    .send({ otp: devOtp });
  // Aceptado: manifestacion_aceptada=1, estado=ACCEPTED

  const r = await request(app)
    .post(`/internal/consentimientos/${consent_id}/expire`)
    .set(ADMIN_HEADERS)
    .send({
      motivo: 'intentar expirar un consentimiento aceptado',
      actor: 'admin-test',
    });
  assert.equal(r.status, 409);
  assert.equal(r.body.error.code, 'CONSENT_EXPIRE_NOT_ALLOWED');
  assert.equal(r.body.error.details.current_state, 'ACCEPTED');

  // Verificar que NO se creó evento
  const ev = db.prepare(
    "SELECT id FROM gh_consentimientos_eventos WHERE consent_id = ? AND evento = 'CONSENT_EXPIRED'"
  ).get(consent_id);
  assert.equal(ev, undefined, 'NO debe crearse evento si el endpoint rechaza');
});

test('POST /expire: estado EXPIRED → 200 con already_expired=true (idempotente)', async () => {
  // Si ya está EXPIRED, el endpoint es idempotente: 200 + already_expired=true.
  resetDb();
  seedActiveAgreement();
  const { consent_id } = await createConsent();
  const app = makeApp();
  // Primera expiración
  const r1 = await request(app)
    .post(`/internal/consentimientos/${consent_id}/expire`)
    .set(ADMIN_HEADERS)
    .send({
      motivo: 'primera expiración de prueba',
      actor: 'admin-test',
    });
  assert.equal(r1.status, 200);
  assert.equal(r1.body.already_expired, undefined);

  // Segunda expiración (idempotente)
  const r2 = await request(app)
    .post(`/internal/consentimientos/${consent_id}/expire`)
    .set(ADMIN_HEADERS)
    .send({
      motivo: 'segunda expiración de prueba idempotente',
      actor: 'admin-test',
    });
  assert.equal(r2.status, 200);
  assert.equal(r2.body.already_expired, true);
  assert.equal(r2.body.estado_anterior, 'EXPIRED');

  // Solo debe haber 1 evento (la segunda llamada no inserta)
  const evs = db.prepare(
    "SELECT id FROM gh_consentimientos_eventos WHERE consent_id = ? AND evento = 'CONSENT_EXPIRED'"
  ).all(consent_id);
  assert.equal(evs.length, 1, 'solo debe haber 1 evento (idempotencia)');
});

test('POST /expire: EXPIRED vía admin permite crear nuevo consent (caso de uso real)', async () => {
  // Caso de uso end-to-end: un consent OTP_PENDING bloquea la creación
  // de nuevos consents para la misma key. Con /expire, se libera la key.
  resetDb();
  seedActiveAgreement();
  const { consent_id } = await createConsent({
    id_trabajador: '555',
    id_empresa: '666',
    correo: 'typo@example.om',  // typo intencional
  });
  const app = makeApp();

  // Intentar crear otro consent para la misma key → 409 CONSENT_PENDING
  const blocked = await request(app)
    .post('/internal/consentimientos')
    .set(HEADERS)
    .send({
      id_trabajador: '555', id_empresa: '666', version_acuerdo: 'v1.0',
      correo_verificacion: 'correct@example.com', kair_version: '0.1.189',
    });
  assert.equal(blocked.status, 409);
  assert.equal(blocked.body.error.code, 'CONSENT_PENDING');

  // Admin expira el consent OTP_PENDING
  const expire = await request(app)
    .post(`/internal/consentimientos/${consent_id}/expire`)
    .set(ADMIN_HEADERS)
    .send({
      motivo: 'correo del firmante tiene typo, liberar key para reintento',
      actor: 'admin-test',
    });
  assert.equal(expire.status, 200);
  assert.equal(expire.body.estado, 'EXPIRED');

  // Ahora sí se puede crear un nuevo consent con el correo correcto
  const fresh = await request(app)
    .post('/internal/consentimientos')
    .set(HEADERS)
    .send({
      id_trabajador: '555', id_empresa: '666', version_acuerdo: 'v1.0',
      correo_verificacion: 'correct@example.com', kair_version: '0.1.189',
    });
  assert.equal(fresh.status, 201);
  assert.notEqual(fresh.body.consent_id, consent_id);
  assert.equal(fresh.body.estado, 'OTP_PENDING');
});

// =========================================================================
// FASE 2 · A1.5.4-B · RECUPERACIÓN CONSENT_PENDING vía create con auto-expire
//
// Comportamiento esperado en POST /internal/consentimientos cuando ya
// existe un consent previo para la misma (id_trabajador, id_empresa,
// version_acuerdo):
//
//   - existing.manifestacion_aceptada === 1
//       → 200 con already_accepted:true (no crea otro)
//   - existing.estado === 'OTP_LOCKED'
//       → 409 CONSENT_LOCKED (no crea otro)
//   - existing.estado === 'OTP_PENDING' + fecha_otp_enviado + (now - ...) > TTL
//       → AUTO-EXPIRA el anterior (transaccional + evento) y crea uno
//         nuevo. Retorna 201 con consent_id NUEVO.
//   - existing.estado === 'OTP_PENDING' + OTP vigente
//       → 409 CONSENT_PENDING (comportamiento actual preservado).
// =========================================================================

test('FASE 2 · POST /internal/consentimientos: ACCEPTED → 200 already_accepted (no crea otro)', async () => {
  resetDb();
  seedActiveAgreement();
  const app = makeApp();
  // Crear y aceptar
  const r1 = await request(app).post('/internal/consentimientos').set(HEADERS).send({
    id_trabajador: '777', id_empresa: '888', version_acuerdo: 'v1.0',
    correo_verificacion: 'accepted@example.com', kair_version: '0.1.189',
  });
  assert.equal(r1.status, 201);
  const consentId = r1.body.consent_id;
  const devOtp = r1.body.devOtp;
  const r2 = await request(app)
    .post(`/internal/consentimientos/${consentId}/verify-otp`)
    .set(HEADERS)
    .send({ otp: devOtp, kair_version: '0.1.189' });
  assert.equal(r2.status, 200);
  // Segundo intento: debe retornar already_accepted, NO crear otro
  const r3 = await request(app).post('/internal/consentimientos').set(HEADERS).send({
    id_trabajador: '777', id_empresa: '888', version_acuerdo: 'v1.0',
    correo_verificacion: 'accepted@example.com', kair_version: '0.1.189',
  });
  assert.equal(r3.status, 200);
  assert.equal(r3.body.already_accepted, true);
  assert.equal(r3.body.consent_id, consentId);
  assert.equal(r3.body.manifestacion_aceptada, true);
  // Solo debe haber 1 fila en BD para esta key
  const rows = db.prepare(
    "SELECT COUNT(*) as n FROM gh_consentimientos_firma WHERE id_trabajador='777' AND id_empresa='888' AND version_acuerdo='v1.0'"
  ).get();
  assert.equal(rows.n, 1);
});

test('FASE 2 · POST /internal/consentimientos: LOCKED → 409 CONSENT_LOCKED (no crea otro)', async () => {
  resetDb();
  seedActiveAgreement();
  const app = makeApp();
  const { consent_id } = await createConsent({
    id_trabajador: '999', id_empresa: '1000', correo: 'locked@example.com',
  });
  // Forzar estado LOCKED directamente en BD (simula exceso de intentos)
  db.prepare(
    "UPDATE gh_consentimientos_firma SET estado = 'OTP_LOCKED' WHERE id = ?"
  ).run(consent_id);
  const r = await request(app).post('/internal/consentimientos').set(HEADERS).send({
    id_trabajador: '999', id_empresa: '1000', version_acuerdo: 'v1.0',
    correo_verificacion: 'locked@example.com', kair_version: '0.1.189',
  });
  assert.equal(r.status, 409);
  assert.equal(r.body.error.code, 'CONSENT_LOCKED');
  // La fila LOCKED debe seguir existiendo (no se tocó)
  const row = db.prepare(
    "SELECT estado FROM gh_consentimientos_firma WHERE id = ?"
  ).get(consent_id);
  assert.equal(row.estado, 'OTP_LOCKED');
});

test('FASE 2 · POST /internal/consentimientos: PENDING + OTP vigente → 409 CONSENT_PENDING (regresión)', async () => {
  // Caso de control: cuando el OTP NO está vencido, NO debe auto-expirar.
  // Mantiene el comportamiento actual (regresión protegida).
  resetDb();
  seedActiveAgreement();
  const app = makeApp();
  const r1 = await request(app).post('/internal/consentimientos').set(HEADERS).send({
    id_trabajador: '111', id_empresa: '222', version_acuerdo: 'v1.0',
    correo_verificacion: 'vigente@example.com', kair_version: '0.1.189',
  });
  assert.equal(r1.status, 201);
  const consentIdVigente = r1.body.consent_id;
  // Sin forceOtpExpired: OTP está vigente (fecha_otp_enviado = now).
  const r2 = await request(app).post('/internal/consentimientos').set(HEADERS).send({
    id_trabajador: '111', id_empresa: '222', version_acuerdo: 'v1.0',
    correo_verificacion: 'vigente@example.com', kair_version: '0.1.189',
  });
  assert.equal(r2.status, 409);
  assert.equal(r2.body.error.code, 'CONSENT_PENDING');
  assert.equal(r2.body.error.details.consent_id, consentIdVigente);
  // La fila PENDING debe seguir PENDING (NO se expiró)
  const row = db.prepare(
    "SELECT estado FROM gh_consentimientos_firma WHERE id = ?"
  ).get(consentIdVigente);
  assert.equal(row.estado, 'OTP_PENDING', 'NO debe auto-expirar si el OTP está vigente');
  // NO debe haber evento CONSENT_EXPIRED
  const ev = db.prepare(
    "SELECT id FROM gh_consentimientos_eventos WHERE consent_id = ? AND evento = 'CONSENT_EXPIRED'"
  ).get(consentIdVigente);
  assert.equal(ev, undefined, 'NO debe generarse evento si el OTP está vigente');
});

test('FASE 2 · POST /internal/consentimientos: PENDING + OTP vencido → 201 nuevo consent, viejo en EXPIRED con evento', async () => {
  // Caso de uso real: el OTP del consent previo está vencido (caso de
  // Lilian). El sistema debe auto-expirar el viejo y crear uno nuevo
  // transparentemente. El usuario (K+AIR) recibe 201 con un nuevo
  // consent_id, OTP fresco, y mail enviado.
  resetDb();
  seedActiveAgreement();
  const app = makeApp();

  // 1. Crear consent inicial
  const r1 = await request(app).post('/internal/consentimientos').set(HEADERS).send({
    id_trabajador: 'LILIAN', id_empresa: '900511178', version_acuerdo: 'v1.0',
    correo_verificacion: 'lilian@example.com', kair_version: '0.1.190',
  });
  assert.equal(r1.status, 201);
  const consentIdViejo = r1.body.consent_id;
  const devOtpViejo = r1.body.devOtp;

  // 2. Forzar OTP vencido (simula el paso del tiempo: 1 hora atrás)
  forceOtpExpired(consentIdViejo);

  // 3. Reintentar create: debe auto-expirar el viejo y crear uno nuevo
  const r2 = await request(app).post('/internal/consentimientos').set(HEADERS).send({
    id_trabajador: 'LILIAN', id_empresa: '900511178', version_acuerdo: 'v1.0',
    correo_verificacion: 'lilian@example.com', kair_version: '0.1.190',
  });
  assert.equal(r2.status, 201, 'debe retornar 201 con nuevo consent');
  const consentIdNuevo = r2.body.consent_id;
  assert.notEqual(consentIdNuevo, consentIdViejo, 'consent_id debe ser NUEVO');
  assert.equal(r2.body.estado, 'OTP_PENDING');
  assert.equal(r2.body.otp_ttl_seconds, 600);
  assert.match(r2.body.devOtp, /^\d{6}$/);
  assert.notEqual(r2.body.devOtp, devOtpViejo, 'OTP nuevo debe ser diferente');

  // 4. El consent viejo debe estar EXPIRED
  const viejo = db.prepare(
    "SELECT estado, updated_at FROM gh_consentimientos_firma WHERE id = ?"
  ).get(consentIdViejo);
  assert.equal(viejo.estado, 'EXPIRED', 'el consent viejo debe estar EXPIRED');

  // 5. El nuevo consent debe estar OTP_PENDING
  const nuevo = db.prepare(
    "SELECT estado, fecha_otp_enviado FROM gh_consentimientos_firma WHERE id = ?"
  ).get(consentIdNuevo);
  assert.equal(nuevo.estado, 'OTP_PENDING');
  assert.ok(nuevo.fecha_otp_enviado, 'debe tener fecha_otp_enviado reciente');

  // 6. Evento CONSENT_EXPIRED registrado para el viejo con motivo correcto
  const ev = db.prepare(
    "SELECT id_actor, metadata FROM gh_consentimientos_eventos WHERE consent_id = ? AND evento = 'CONSENT_EXPIRED'"
  ).get(consentIdViejo);
  assert.ok(ev, 'debe existir evento CONSENT_EXPIRED para el viejo');
  assert.equal(ev.id_actor, 'sistema:recreate-on-expired');
  const meta = JSON.parse(ev.metadata);
  assert.equal(meta.motivo, 'recreate_on_expired_create');
  assert.equal(meta.ttl_seconds, 600);

  // 7. El mailer debe haber enviado 2 emails (1 viejo + 1 nuevo)
  const mailer = require('../../src/services/mailer');
  const inbox = mailer.getDevInbox();
  assert.ok(inbox.length >= 2, `debe haber al menos 2 emails (viejo + nuevo), inbox=${inbox.length}`);

  // 8. Solo debe haber 1 evento CONSENT_EXPIRED (no duplicados)
  const evsViejo = db.prepare(
    "SELECT id FROM gh_consentimientos_eventos WHERE consent_id = ? AND evento = 'CONSENT_EXPIRED'"
  ).all(consentIdViejo);
  assert.equal(evsViejo.length, 1, 'solo 1 evento de expiración para el viejo');

  // 9. UNIQUE INDEX parcial debe seguir intacto: solo PENDING/LOCKED lo activan
  const indexCheck = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_consentimientos_key_activo'"
  ).get();
  assert.ok(indexCheck, 'el índice parcial idx_consentimientos_key_activo debe existir');
});
