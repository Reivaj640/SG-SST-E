/**
 * Tests del RF-FIRMA-CORREO-01 (I-103.A1.6.C): correo del firmante persistido
 * explícitamente en gh_firmas_electronicas.correo_verificacion al crear el SR.
 *
 * Cubre:
 *  - service.create() acepta correo_verificacion y lo persiste en la columna
 *    directa (más correo_hash con sal).
 *  - service.create() sin correo_verificacion funciona como antes (legacy).
 *  - publicFlow.resolveCorreo() prioriza la columna directa sobre metadata.correo
 *    y sobre consent.correo_verificacion.
 *  - publicFlow.resolveCorreo() cae al fallback de metadata si la columna está vacía.
 *  - publicFlow.resolveCorreo() cae al fallback de consent si metadata tampoco.
 *  - publicFlow.resolveCorreo() retorna null si todo está vacío.
 *
 * NOTA: este test NO está incluido en el glob de `npm test`. Se ejecuta
 * manualmente con:
 *   node --test --require ./tests/setup.js tests/services/rf-firma-correo-01.test.js
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { resetDb, seedActiveAgreement } = require('../helpers');
const signRequestService = require('../../src/services/signRequest');
const publicFlow = require('../../src/services/publicFlow');
const db = require('../../src/db/connection');
const { sha256 } = require('../../src/crypto/hash');

// PDF mínimo válido (magic bytes %PDF-)
function makePdf() {
  return Buffer.concat([
    Buffer.from('%PDF-1.4\n'),
    Buffer.from('1 0 obj\n<< /Type /Catalog >>\nendobj\n'),
    Buffer.from('trailer\n<< /Root 1 0 R >>\n%%EOF\n'),
  ]);
}

function buildOpts(acuerdo, overrides = {}) {
  const pdf = makePdf();
  return {
    id_documento: 'doc-rfc01-' + (overrides.suffix || '001'),
    id_trabajador: '1234567890',
    id_empresa: '900123456',
    tipo_firma: 'presencial',
    agreement_version: acuerdo.version,
    agreement_hash: acuerdo.texto_hash,
    document_hash: sha256(pdf),
    pdf_buffer: pdf,
    pdf_filename: 'contrato.pdf',
    pdfName: 'contrato.pdf',
    version_kair: '0.1.190',
    ip: '127.0.0.1',
    user_agent: 'rf-firma-correo-01-test',
    identificacion_tipo: 'CC',
    identificacion_numero_hash: sha256('1234567890'),
    ...overrides,
  };
}

test.beforeEach(() => {
  resetDb();
  seedActiveAgreement({ version: 'v1.0' });
});

// =====================================================================
// service.create() — persistencia de correo_verificacion
// =====================================================================

test('RF-FIRMA-CORREO-01: create() con correo_verificacion persiste en columna directa', () => {
  const acuerdo = require('../../src/services/agreement').getActive();
  const opts = buildOpts(acuerdo, {
    suffix: 'a',
    correo_verificacion: 'firmante.real@example.com',
  });
  const result = signRequestService.create(opts);
  assert.ok(result.signRequest);
  assert.equal(result.signRequest.correo_verificacion, 'firmante.real@example.com');
  // correo_hash también debe estar presente (no null)
  assert.ok(result.signRequest.correo_hash, 'correo_hash debe estar presente');
  // El hash NO debe ser el plaintext
  assert.notEqual(result.signRequest.correo_hash, 'firmante.real@example.com');
  // El hash debe ser hex de 64 chars (SHA-256)
  assert.match(result.signRequest.correo_hash, /^[0-9a-f]{64}$/);
});

test('RF-FIRMA-CORREO-01: create() SIN correo_verificacion persiste NULL (compatibilidad legacy)', () => {
  const acuerdo = require('../../src/services/agreement').getActive();
  const opts = buildOpts(acuerdo, { suffix: 'b' });
  delete opts.correo_verificacion;
  const result = signRequestService.create(opts);
  assert.equal(result.signRequest.correo_verificacion, null);
  assert.equal(result.signRequest.correo_hash, null);
});

test('RF-FIRMA-CORREO-01: create() rechaza correo_verificacion sin @ (no es email)', () => {
  const acuerdo = require('../../src/services/agreement').getActive();
  const opts = buildOpts(acuerdo, {
    suffix: 'c',
    correo_verificacion: 'esto no tiene arroba',
  });
  // El service verifica includes('@') como validación mínima.
  // Si no tiene @, NO persiste. (Validación completa de email la hace zod en el schema.)
  const result = signRequestService.create(opts);
  assert.equal(result.signRequest.correo_verificacion, null);
  assert.equal(result.signRequest.correo_hash, null);
});

// =====================================================================
// publicFlow.resolveCorreo() — orden de prioridad
// =====================================================================

test('RF-FIRMA-CORREO-01: resolveCorreo prioriza correo_verificacion (columna directa)', () => {
  const acuerdo = require('../../src/services/agreement').getActive();
  const opts = buildOpts(acuerdo, {
    suffix: 'prio1',
    correo_verificacion: 'PRIORIDAD_1@directa.com',
    metadata: JSON.stringify({ correo: 'PRIORIDAD_2@metadata.com' }),
  });
  const { signRequest: sr } = signRequestService.create(opts);

  // Construir un signRequest con consent_id para forzar la rama 3
  const acuerdoForP1 = db.prepare('SELECT * FROM gh_firma_acuerdo_versiones WHERE activa = 1').get();
  const consentResultP1 = db.prepare(`
    INSERT INTO gh_consentimientos_firma
      (id_trabajador, id_empresa, version_acuerdo, hash_texto_acuerdo,
       correo_verificacion, correo_hash, otp_hash, otp_sal, otp_intentos,
       ip, user_agent, kair_version, manifestacion_aceptada, estado)
    VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 0, ?, ?, ?, 0, 'OTP_PENDING')
  `).run(
    '1234567890', '900123456', 'v1.0', acuerdoForP1.texto_hash,
    'PRIORIDAD_3@consent.com', 'hash-fake',
    '127.0.0.1', 'test', '0.1.190-test'
  );
  db.prepare('UPDATE gh_firmas_electronicas SET consent_id = ? WHERE id = ?').run(consentResultP1.lastInsertRowid, sr.id);

  // Releer el SR para que tenga consent_id
  const sr2 = signRequestService.getById(sr.id);

  const resultado = publicFlow._resolveCorreo(sr2);
  assert.equal(resultado, 'PRIORIDAD_1@directa.com',
    'Debe retornar la prioridad 1 (columna directa), NO la 3 (consent)');
});

test('RF-FIRMA-CORREO-01: resolveCorreo cae a metadata.correo si columna directa está vacía', () => {
  const acuerdo = require('../../src/services/agreement').getActive();
  const opts = buildOpts(acuerdo, {
    suffix: 'prio2',
    metadata: JSON.stringify({ correo: 'PRIORIDAD_2@metadata.com' }),
  });
  // sin correo_verificacion
  delete opts.correo_verificacion;
  const { signRequest: sr } = signRequestService.create(opts);

  const sr2 = signRequestService.getById(sr.id);
  assert.equal(sr2.correo_verificacion, null);

  const resultado = publicFlow._resolveCorreo(sr2);
  assert.equal(resultado, 'PRIORIDAD_2@metadata.com');
});

test('RF-FIRMA-CORREO-01: resolveCorreo cae a consent.correo_verificacion como último fallback', () => {
  const acuerdo = db.prepare('SELECT * FROM gh_firma_acuerdo_versiones WHERE activa = 1').get();
  // Crear el SR SIN correo_verificacion, SIN metadata.correo
  const opts = buildOpts(acuerdo, {
    suffix: 'prio3',
    id_trabajador: '99990001',
    metadata: JSON.stringify({}),
  });
  delete opts.correo_verificacion;
  const { signRequest: sr } = signRequestService.create(opts);

  // Crear el consent directamente en la BD (el helper createPendingConsent
  // depende de HTTP y no retorna consent_id confiable en este test runner).
  const consentResult = db.prepare(`
    INSERT INTO gh_consentimientos_firma
      (id_trabajador, id_empresa, version_acuerdo, hash_texto_acuerdo,
       correo_verificacion, correo_hash, otp_hash, otp_sal, otp_intentos,
       ip, user_agent, kair_version, manifestacion_aceptada, estado)
    VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 0, ?, ?, ?, 0, 'OTP_PENDING')
  `).run(
    '99990001', '900123456', 'v1.0', acuerdo.texto_hash,
    'PRIORIDAD_3@consent.com', 'hash-fake',
    '127.0.0.1', 'test', '0.1.190-test'
  );
  const consentId = consentResult.lastInsertRowid;
  db.prepare('UPDATE gh_firmas_electronicas SET consent_id = ? WHERE id = ?').run(consentId, sr.id);

  const sr2 = signRequestService.getById(sr.id);
  assert.equal(sr2.consent_id, consentId);
  const resultado = publicFlow._resolveCorreo(sr2);
  assert.equal(resultado, 'PRIORIDAD_3@consent.com');
});

test('RF-FIRMA-CORREO-01: resolveCorreo retorna null si no hay ninguna fuente', () => {
  const acuerdo = require('../../src/services/agreement').getActive();
  const opts = buildOpts(acuerdo, {
    suffix: 'null',
    metadata: JSON.stringify({}),
  });
  delete opts.correo_verificacion;
  const { signRequest: sr } = signRequestService.create(opts);
  // sin consent_id

  const sr2 = signRequestService.getById(sr.id);
  const resultado = publicFlow._resolveCorreo(sr2);
  assert.equal(resultado, null);
});

test('RF-FIRMA-CORREO-01: el correo persistido en el SR no cambia aunque cambie el consent', () => {
  // Caso clave del RF: el correo del SR queda congelado al crear.
  // Aunque después se cambie el correo del consent, el SR sigue usando
  // su correo_verificacion original.
  const acuerdo = db.prepare('SELECT * FROM gh_firma_acuerdo_versiones WHERE activa = 1').get();
  const opts = buildOpts(acuerdo, {
    suffix: 'congelado',
    id_trabajador: '99990002',
    correo_verificacion: 'CONGELADO@sr.com',
  });
  const { signRequest: sr } = signRequestService.create(opts);

  // Crear el consent directamente con un correo DIFERENTE
  const consentResult = db.prepare(`
    INSERT INTO gh_consentimientos_firma
      (id_trabajador, id_empresa, version_acuerdo, hash_texto_acuerdo,
       correo_verificacion, correo_hash, otp_hash, otp_sal, otp_intentos,
       ip, user_agent, kair_version, manifestacion_aceptada, estado)
    VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 0, ?, ?, ?, 0, 'OTP_PENDING')
  `).run(
    '99990002', '900123456', 'v1.0', acuerdo.texto_hash,
    'CAMBIADO@consent.com', 'hash-fake',
    '127.0.0.1', 'test', '0.1.190-test'
  );
  const consentId = consentResult.lastInsertRowid;
  db.prepare('UPDATE gh_firmas_electronicas SET consent_id = ? WHERE id = ?').run(consentId, sr.id);

  const sr2 = signRequestService.getById(sr.id);
  const resultado = publicFlow._resolveCorreo(sr2);
  assert.equal(resultado, 'CONGELADO@sr.com',
    'El correo del SR debe estar congelado, NO debe cambiar al del consent');
});
