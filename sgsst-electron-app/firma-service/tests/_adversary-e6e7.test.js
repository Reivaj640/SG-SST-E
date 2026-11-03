'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const db = require('../src/db/connection');
const { resetDb, seedActiveAgreement, makeApp, TEST_API_KEY, TEST_ADMIN_API_KEY } = require('./helpers');
const consentService = require('../src/services/consent');
const signRequestService = require('../src/services/signRequest');
const { sha256 } = require('../src/crypto/hash');
const { PDFDocument } = require('pdf-lib');
const INTERNAL_HEADERS = { 'X-Internal-API-Key': TEST_API_KEY };
const ADMIN_HEADERS = { 'X-Admin-API-Key': TEST_ADMIN_API_KEY };
function makePdfBuffer() { return Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n'); }
function createSr(overrides) {
  if (!overrides) overrides = {};
  const acuerdo = require('../src/services/agreement').getActive();
  const r = signRequestService.create(Object.assign({
    id_documento: 'doc-test', id_trabajador: '1234567890', id_empresa: '900123456',
    tipo_firma: 'presencial', agreement_version: acuerdo.version, agreement_hash: acuerdo.texto_hash,
    document_hash: sha256(makePdfBuffer()), pdf_buffer: makePdfBuffer(), pdf_filename: 't.pdf',
    version_kair: '0.1.189-test',
  }, overrides));
  return r.signRequest;
}
async function makeValidPdf() { const pdf = await PDFDocument.create(); pdf.addPage([200, 200]); return Buffer.from(await pdf.save()); }

// E6 EDGE CASES
test('ADVE6.1: consent_id=0 -> CONSENT_NOT_FOUND', () => {
  resetDb(); seedActiveAgreement({ version: 'v1.0' });
  const sr = { id:1, id_solicitud:'X', id_trabajador:'1', id_empresa:'1', agreement_version:'v1.0', consent_id:0 };
  assert.throws(() => consentService.validateForCommit(sr), e => e.code === 'CONSENT_NOT_FOUND');
});
test('ADVE6.2: consent_id negativo -> CONSENT_NOT_FOUND', () => {
  resetDb(); seedActiveAgreement({ version: 'v1.0' });
  const sr = { id:1, id_solicitud:'X', id_trabajador:'1', id_empresa:'1', agreement_version:'v1.0', consent_id:-1 };
  assert.throws(() => consentService.validateForCommit(sr), e => e.code === 'CONSENT_NOT_FOUND');
});
test('ADVE6.3: consent_id string "5" -> CONSENT_NOT_FOUND', () => {
  resetDb(); seedActiveAgreement({ version: 'v1.0' });
  const sr = { id:1, id_solicitud:'X', id_trabajador:'1', id_empresa:'1', agreement_version:'v1.0', consent_id:'5' };
  assert.throws(() => consentService.validateForCommit(sr), e => e.code === 'CONSENT_NOT_FOUND');
});
test('ADVE6.4: agreement_version vacio -> skip:true', () => {
  assert.equal(consentService.validateForCommit({ agreement_version:'', consent_id:null }).skip, true);
});
test('ADVE6.5: getById float -> null', () => { assert.equal(consentService.getById(3.7), null); });
test('ADVE6.6: getById NaN -> null', () => { assert.equal(consentService.getById(NaN), null); });
test('ADVE6.7: zod acepta "5" (coerce)', async () => {
  resetDb(); seedActiveAgreement({ version: 'v1.0' });
  const app = makeApp();
  const acuerdo = require('../src/services/agreement').getActive();
  const pdfBuf = await makeValidPdf();
  const meta = { id_documento:'d', id_trabajador:'1', id_empresa:'1', tipo_firma:'presencial',
    agreement_version:acuerdo.version, agreement_hash:acuerdo.texto_hash, document_hash:sha256(pdfBuf),
    version_kair:'0.1.189', consent_id:'5',
    // El control de declaracion de datos sensibles de salud (exigido desde el commit
    // 5534aca7) se comprueba DESPUES del schema: sin esta declaracion la ruta
    // responde 422 y este test no mediria lo que dice medir (la coercion del "5").
    declaracion_datos_sensibles:'EL_DOCUMENTO_NO_CONTIENE_DATOS_SENSIBLES_DE_SALUD' };
  const r = await request(app).post('/internal/sign-requests').set(INTERNAL_HEADERS)
    .field('metadata', JSON.stringify(meta)).attach('documento', pdfBuf, 'd.pdf');
  assert.equal(r.status, 201);
});
test('ADVE6.8: zod rechaza "abc"', async () => {
  resetDb(); seedActiveAgreement({ version: 'v1.0' });
  const app = makeApp();
  const acuerdo = require('../src/services/agreement').getActive();
  const pdfBuf = await makeValidPdf();
  const meta = { id_documento:'d', id_trabajador:'1', id_empresa:'1', tipo_firma:'presencial',
    agreement_version:acuerdo.version, agreement_hash:acuerdo.texto_hash, document_hash:sha256(pdfBuf),
    version_kair:'0.1.189', consent_id:'abc' };
  const r = await request(app).post('/internal/sign-requests').set(INTERNAL_HEADERS)
    .field('metadata', JSON.stringify(meta)).attach('documento', pdfBuf, 'd.pdf');
  assert.equal(r.status, 400);
});
test('ADVE6.9: zod rechaza 0', async () => {
  resetDb(); seedActiveAgreement({ version: 'v1.0' });
  const app = makeApp();
  const acuerdo = require('../src/services/agreement').getActive();
  const pdfBuf = await makeValidPdf();
  const meta = { id_documento:'d', id_trabajador:'1', id_empresa:'1', tipo_firma:'presencial',
    agreement_version:acuerdo.version, agreement_hash:acuerdo.texto_hash, document_hash:sha256(pdfBuf),
    version_kair:'0.1.189', consent_id:0 };
  const r = await request(app).post('/internal/sign-requests').set(INTERNAL_HEADERS)
    .field('metadata', JSON.stringify(meta)).attach('documento', pdfBuf, 'd.pdf');
  assert.equal(r.status, 400);
});
test('ADVE6.10: zod rechaza -5', async () => {
  resetDb(); seedActiveAgreement({ version: 'v1.0' });
  const app = makeApp();
  const acuerdo = require('../src/services/agreement').getActive();
  const pdfBuf = await makeValidPdf();
  const meta = { id_documento:'d', id_trabajador:'1', id_empresa:'1', tipo_firma:'presencial',
    agreement_version:acuerdo.version, agreement_hash:acuerdo.texto_hash, document_hash:sha256(pdfBuf),
    version_kair:'0.1.189', consent_id:-5 };
  const r = await request(app).post('/internal/sign-requests').set(INTERNAL_HEADERS)
    .field('metadata', JSON.stringify(meta)).attach('documento', pdfBuf, 'd.pdf');
  assert.equal(r.status, 400);
});
test('ADVE6.11: zod rechaza float 5.7', async () => {
  resetDb(); seedActiveAgreement({ version: 'v1.0' });
  const app = makeApp();
  const acuerdo = require('../src/services/agreement').getActive();
  const pdfBuf = await makeValidPdf();
  const meta = { id_documento:'d', id_trabajador:'1', id_empresa:'1', tipo_firma:'presencial',
    agreement_version:acuerdo.version, agreement_hash:acuerdo.texto_hash, document_hash:sha256(pdfBuf),
    version_kair:'0.1.189', consent_id:5.7 };
  const r = await request(app).post('/internal/sign-requests').set(INTERNAL_HEADERS)
    .field('metadata', JSON.stringify(meta)).attach('documento', pdfBuf, 'd.pdf');
  assert.equal(r.status, 400);
});

// E7.1 AUDIT EDGE CASES
test('ADVE7.1.1: audit id=0 -> 404', async () => {
  resetDb();
  const r = await request(makeApp()).get('/internal/sign-requests/0/eventos').set(INTERNAL_HEADERS);
  assert.equal(r.status, 404);
});
test('ADVE7.1.2: audit id=-1 -> 400', async () => {
  resetDb();
  const r = await request(makeApp()).get('/internal/sign-requests/-1/eventos').set(INTERNAL_HEADERS);
  assert.equal(r.status, 400);
});
test('ADVE7.1.3: audit filtra secrets anidados profundos', async () => {
  resetDb(); seedActiveAgreement();
  const sr = createSr();
  db.prepare('INSERT INTO gh_firma_eventos (firma_id, evento, fecha_hora, metadata, id_actor) VALUES (?, ?, ?, ?, ?)')
    .run(sr.id, 'DEEP', '2026-08-19T13:00:00.000000Z', JSON.stringify({l1:{l2:{l3:{password:'sec',safe:'ok'}},token:'abc'}}), 'sistema');
  const r = await request(makeApp()).get(`/internal/sign-requests/${sr.id_solicitud}/eventos`).set(INTERNAL_HEADERS);
  const ev = r.body.eventos.find(e => e.tipo_evento === 'DEEP');
  assert.equal(ev.metadata.l1.l2.l3.password, '[REDACTED]');
  assert.equal(ev.metadata.l1.l2.l3.safe, 'ok');
  assert.equal(ev.metadata.l1.token, '[REDACTED]');
});
test('ADVE7.1.4: audit metadata corrupto -> null, no 500', async () => {
  resetDb(); seedActiveAgreement();
  const sr = createSr();
  db.prepare('INSERT INTO gh_firma_eventos (firma_id, evento, fecha_hora, metadata, id_actor) VALUES (?, ?, ?, ?, ?)')
    .run(sr.id, 'CORRUPT', '2026-08-19T13:00:00.000000Z', 'esto no es JSON {{{', 'sistema');
  const r = await request(makeApp()).get(`/internal/sign-requests/${sr.id_solicitud}/eventos`).set(INTERNAL_HEADERS);
  assert.equal(r.status, 200);
  const ev = r.body.eventos.find(e => e.tipo_evento === 'CORRUPT');
  assert.equal(ev.metadata, null);
});
test('ADVE7.1.5: audit metadata=array -> filtra', async () => {
  resetDb(); seedActiveAgreement();
  const sr = createSr();
  db.prepare('INSERT INTO gh_firma_eventos (firma_id, evento, fecha_hora, metadata, id_actor) VALUES (?, ?, ?, ?, ?)')
    .run(sr.id, 'ARR', '2026-08-19T13:00:00.000000Z', JSON.stringify([{password:'p1'},{token:'t2',safe:'ok'}]), 'sistema');
  const r = await request(makeApp()).get(`/internal/sign-requests/${sr.id_solicitud}/eventos`).set(INTERNAL_HEADERS);
  const ev = r.body.eventos.find(e => e.tipo_evento === 'ARR');
  assert.ok(Array.isArray(ev.metadata));
  assert.equal(ev.metadata[0].password, '[REDACTED]');
  assert.equal(ev.metadata[1].token, '[REDACTED]');
});
test('ADVE7.1.6: audit filtra case-mixed', async () => {
  resetDb(); seedActiveAgreement();
  const sr = createSr();
  db.prepare('INSERT INTO gh_firma_eventos (firma_id, evento, fecha_hora, metadata, id_actor) VALUES (?, ?, ?, ?, ?)')
    .run(sr.id, 'CASE', '2026-08-19T13:00:00.000000Z', JSON.stringify({Password:'p1',TOKEN:'t2'}), 'sistema');
  const r = await request(makeApp()).get(`/internal/sign-requests/${sr.id_solicitud}/eventos`).set(INTERNAL_HEADERS);
  const ev = r.body.eventos.find(e => e.tipo_evento === 'CASE');
  assert.equal(ev.metadata.Password, '[REDACTED]');
  assert.equal(ev.metadata.TOKEN, '[REDACTED]');
});
test('ADVE7.1.7: audit secret null -> null', async () => {
  resetDb(); seedActiveAgreement();
  const sr = createSr();
  db.prepare('INSERT INTO gh_firma_eventos (firma_id, evento, fecha_hora, metadata, id_actor) VALUES (?, ?, ?, ?, ?)')
    .run(sr.id, 'NULL', '2026-08-19T13:00:00.000000Z', JSON.stringify({token:null, password:''}), 'sistema');
  const r = await request(makeApp()).get(`/internal/sign-requests/${sr.id_solicitud}/eventos`).set(INTERNAL_HEADERS);
  const ev = r.body.eventos.find(e => e.tipo_evento === 'NULL');
  assert.equal(ev.metadata.token, null);
  assert.equal(ev.metadata.password, null);
});
test('ADVE7.1.8: audit filtra identificacion_numero', async () => {
  resetDb(); seedActiveAgreement();
  const sr = createSr();
  db.prepare('INSERT INTO gh_firma_eventos (firma_id, evento, fecha_hora, metadata, id_actor) VALUES (?, ?, ?, ?, ?)')
    .run(sr.id, 'IDENT', '2026-08-19T13:00:00.000000Z', JSON.stringify({identificacion_numero:'1234567890', tipo_documento:'CC'}), 'sistema');
  const r = await request(makeApp()).get(`/internal/sign-requests/${sr.id_solicitud}/eventos`).set(INTERNAL_HEADERS);
  const ev = r.body.eventos.find(e => e.tipo_evento === 'IDENT');
  assert.equal(ev.metadata.identificacion_numero, '[REDACTED]');
  assert.equal(ev.metadata.tipo_documento, 'CC');
});
test('ADVE7.1.9: audit filtra correo_verificacion', async () => {
  resetDb(); seedActiveAgreement();
  const sr = createSr();
  db.prepare('INSERT INTO gh_firma_eventos (firma_id, evento, fecha_hora, metadata, id_actor) VALUES (?, ?, ?, ?, ?)')
    .run(sr.id, 'CORREO', '2026-08-19T13:00:00.000000Z', JSON.stringify({correo_verificacion:'juan@x.com', canal:'email'}), 'sistema');
  const r = await request(makeApp()).get(`/internal/sign-requests/${sr.id_solicitud}/eventos`).set(INTERNAL_HEADERS);
  const ev = r.body.eventos.find(e => e.tipo_evento === 'CORREO');
  assert.equal(ev.metadata.correo_verificacion, '[REDACTED]');
  assert.equal(ev.metadata.canal, 'email');
});

// E7.2 REVOKE EDGE CASES
test('ADVE7.2.1: revoke estado SIGNED -> 409', async () => {
  resetDb(); seedActiveAgreement();
  const sr = createSr();
  db.prepare('UPDATE gh_firmas_electronicas SET estado = ? WHERE id = ?').run('SIGNED', sr.id);
  const r = await request(makeApp()).post(`/internal/sign-requests/${sr.id_solicitud}/revoke`)
    .set(ADMIN_HEADERS).send({motivo:'a'.repeat(20), actor:'a@x.com'});
  assert.equal(r.status, 409);
  assert.equal(r.body.error.code, 'REVOKE_NOT_ALLOWED');
});
test('ADVE7.2.2: revoke body vacio -> 400', async () => {
  resetDb(); seedActiveAgreement();
  const sr = createSr();
  const r = await request(makeApp()).post(`/internal/sign-requests/${sr.id_solicitud}/revoke`)
    .set(ADMIN_HEADERS).send({});
  assert.equal(r.status, 400);
});
test('ADVE7.2.3: revoke motivo 10 chars -> 200', async () => {
  resetDb(); seedActiveAgreement();
  const sr = createSr();
  const r = await request(makeApp()).post(`/internal/sign-requests/${sr.id_solicitud}/revoke`)
    .set(ADMIN_HEADERS).send({motivo:'a'.repeat(10), actor:'a@x.com'});
  assert.equal(r.status, 200);
});
test('ADVE7.2.4: revoke motivo 9 chars -> 400', async () => {
  resetDb(); seedActiveAgreement();
  const sr = createSr();
  const r = await request(makeApp()).post(`/internal/sign-requests/${sr.id_solicitud}/revoke`)
    .set(ADMIN_HEADERS).send({motivo:'a'.repeat(9), actor:'a@x.com'});
  assert.equal(r.status, 400);
});
test('ADVE7.2.5: revoke idempotente', async () => {
  resetDb(); seedActiveAgreement();
  const sr = createSr();
  const app = makeApp();
  await request(app).post(`/internal/sign-requests/${sr.id_solicitud}/revoke`)
    .set(ADMIN_HEADERS).send({motivo:'a'.repeat(15), actor:'a@x.com'});
  await request(app).post(`/internal/sign-requests/${sr.id_solicitud}/revoke`)
    .set(ADMIN_HEADERS).send({motivo:'b'.repeat(15), actor:'b@x.com'});
  const n = db.prepare('SELECT COUNT(*) AS n FROM gh_firma_eventos WHERE firma_id = ? AND evento = ?').get(sr.id, 'REVOKED').n;
  assert.equal(n, 1);
});
test('ADVE7.2.6: revoke estado OPENED -> 200', async () => {
  resetDb(); seedActiveAgreement();
  const sr = createSr();
  db.prepare('UPDATE gh_firmas_electronicas SET estado = ? WHERE id = ?').run('OPENED', sr.id);
  const r = await request(makeApp()).post(`/internal/sign-requests/${sr.id_solicitud}/revoke`)
    .set(ADMIN_HEADERS).send({motivo:'a'.repeat(15), actor:'a@x.com'});
  assert.equal(r.status, 200);
  assert.equal(r.body.estado_anterior, 'OPENED');
});
test('ADVE7.2.7: revoke estado OTP_SENT (gap) -> 409', async () => {
  resetDb(); seedActiveAgreement();
  const sr = createSr();
  db.prepare('UPDATE gh_firmas_electronicas SET estado = ? WHERE id = ?').run('OTP_SENT', sr.id);
  const r = await request(makeApp()).post(`/internal/sign-requests/${sr.id_solicitud}/revoke`)
    .set(ADMIN_HEADERS).send({motivo:'a'.repeat(15), actor:'a@x.com'});
  assert.equal(r.status, 409);
  assert.equal(r.body.error.details.current_state, 'OTP_SENT');
});
test('ADVE7.2.8: revoke id_actor prefijo admin:', async () => {
  resetDb(); seedActiveAgreement();
  const sr = createSr();
  const app = makeApp();
  await request(app).post(`/internal/sign-requests/${sr.id_solicitud}/revoke`)
    .set(ADMIN_HEADERS).send({motivo:'a'.repeat(15), actor:'juridico@empresa.com'});
  const ev = db.prepare('SELECT id_actor, metadata FROM gh_firma_eventos WHERE firma_id = ? AND evento = ?').get(sr.id, 'REVOKED');
  assert.equal(ev.id_actor, 'admin:juridico@empresa.com');
});
test('ADVE7.2.9: cross-empresa misma API key (single-tenant)', async () => {
  resetDb(); seedActiveAgreement();
  const srA = createSr({ id_empresa: '900AAA', id_trabajador: '11111111', id_documento: 'doc-A' });
  const srB = createSr({ id_empresa: '900BBB', id_trabajador: '22222222', id_documento: 'doc-B' });
  const app = makeApp();
  const r1 = await request(app).get(`/internal/sign-requests/${srA.id_solicitud}/eventos`).set(INTERNAL_HEADERS);
  const r2 = await request(app).post(`/internal/sign-requests/${srB.id_solicitud}/revoke`)
    .set(ADMIN_HEADERS).send({motivo:'a'.repeat(15), actor:'a@x.com'});
  assert.equal(r1.status, 200, 'single-tenant: cross-empresa visible');
  assert.equal(r2.status, 200, 'single-tenant: cross-empresa revocable');
});
test('ADVE7.2.10: revoke -> aparece en audit trail', async () => {
  resetDb(); seedActiveAgreement();
  const sr = createSr();
  const app = makeApp();
  await request(app).post(`/internal/sign-requests/${sr.id_solicitud}/revoke`)
    .set(ADMIN_HEADERS).send({motivo:'a'.repeat(15), actor:'juridico@x.com'});
  const r = await request(app).get(`/internal/sign-requests/${sr.id_solicitud}/eventos`).set(INTERNAL_HEADERS);
  const revoked = r.body.eventos.find(e => e.tipo_evento === 'REVOKED');
  assert.ok(revoked);
  assert.equal(revoked.metadata.actor, 'juridico@x.com');
  assert.equal(revoked.metadata.estado_anterior, 'PENDING');
});
test('ADVE7.2.11: revoke motivo 500 chars -> 200', async () => {
  resetDb(); seedActiveAgreement();
  const sr = createSr();
  const r = await request(makeApp()).post(`/internal/sign-requests/${sr.id_solicitud}/revoke`)
    .set(ADMIN_HEADERS).send({motivo:'x'.repeat(500), actor:'a@x.com'});
  assert.equal(r.status, 200);
});
test('ADVE7.2.12: revoke motivo 501 chars -> 400', async () => {
  resetDb(); seedActiveAgreement();
  const sr = createSr();
  const r = await request(makeApp()).post(`/internal/sign-requests/${sr.id_solicitud}/revoke`)
    .set(ADMIN_HEADERS).send({motivo:'x'.repeat(501), actor:'a@x.com'});
  assert.equal(r.status, 400);
});
test('ADVE7.2.13: revoke motivo solo espacios -> 400', async () => {
  resetDb(); seedActiveAgreement();
  const sr = createSr();
  const r = await request(makeApp()).post(`/internal/sign-requests/${sr.id_solicitud}/revoke`)
    .set(ADMIN_HEADERS).send({motivo:' '.repeat(10), actor:'a@x.com'});
  assert.equal(r.status, 400);
});
test('ADVE7.2.14: revoke con internal key en header equivocado -> 401', async () => {
  resetDb(); seedActiveAgreement();
  const sr = createSr();
  const r = await request(makeApp()).post(`/internal/sign-requests/${sr.id_solicitud}/revoke`)
    .set(INTERNAL_HEADERS).send({motivo:'a'.repeat(15), actor:'a@x.com'});
  assert.equal(r.status, 401);
});
