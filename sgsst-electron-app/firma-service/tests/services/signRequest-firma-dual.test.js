/**
 * Tests del servicio signRequest — Bloque I-FIRMA-DUAL (Fase 1B, v0.1.180):
 * signRequestService.createForCompany().
 *
 * createForCompany crea un sign request HIJO (tipo_firmante='EMPRESA') que
 * queda vinculado a un sign request PADRE mediante parent_id_solicitud.
 * El padre debe tener requiere_firma_empresa=1 (opt-in explícito del RH).
 *
 * Esta tarea es el RED step del TDD para createForCompany: la función
 * NO EXISTE AÚN (Task 1.5 la va a implementar). Los 3 tests deben fallar
 * con `signRequestService.createForCompany is not a function` o similar.
 *
 * Cubre:
 * - Camino feliz: createForCompany crea hijo vinculado al padre
 *   (tipo_firmante=EMPRESA, id_trabajador=null, parent_id_solicitud=padre.id_solicitud,
 *   correo_verificacion=representante.correo, id_solicitud distinto al padre).
 * - Validación: createForCompany rechaza si el padre no tiene requiere_firma_empresa=1
 *   (legacy flow no debe poder generar hijo).
 * - UNIQUE: createForCompany rechaza si ya existe un hijo para ese padre
 *   (idx_gh_firmas_unico_hijo en migration 013).
 *
 * NOTA sobre el estado de create() en este RED step:
 *   El create() actual NO acepta `requiere_firma_empresa` ni
 *   `representante_legal_snapshot` en opts (ver signRequest.js#create
 *   líneas 388-397). Eso está OK para este RED step — la línea
 *   `signRequestService.create({ ...padreOpts, requiere_firma_empresa: 1, ... })`
 *   pasa el flag en opts pero create() lo ignora silenciosamente, y el test
 *   falla en `createForCompany is not a function` ANTES de poder verificar
 *   si el flag se persistió o no.
 *
 *   Task 1.5 deberá:
 *     1. Implementar createForCompany.
 *     2. Agregar soporte en create() para requiere_firma_empresa y
 *        representante_legal_snapshot (sin esto, el padre siempre queda con
 *        requiere_firma_empresa=0 y el test "falla si el padre no tiene flag"
 *        pasa por error — el padre NUNCA tendría el flag).
 *
 * NOTA sobre scope: este test vive en tests/services/ que NO está incluido
 * en el glob de `npm test`. Se ejecuta manualmente con:
 *   node --test --require ./tests/setup.js tests/services/signRequest-firma-dual.test.js
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { resetDb, seedActiveAgreement } = require('../helpers');
const signRequestService = require('../../src/services/signRequest');
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
    id_documento: 'doc-firma-dual-1',
    id_trabajador: '1234567890',
    id_empresa: '900123456',
    tipo_firma: 'presencial',
    agreement_version: acuerdo.version,
    agreement_hash: acuerdo.texto_hash,
    document_hash: sha256(pdf),
    pdf_buffer: pdf,
    pdf_filename: 'contrato.pdf',
    version_kair: '0.1.180-test',
    ...overrides,
  };
}

// Snapshot del representante legal (D-2 / Task 1.5 lo definirá formalmente;
// mientras tanto, esta es la forma del payload que se persiste en
// gh_firmas_electronicas.representante_legal_snapshot como JSON).
const REP = {
  nombre: 'Juan Pérez',
  tipo_identificacion: 'CC',
  numero_identificacion: '1234567890',
  correo: 'juan.rep@test.com',
  cargo: 'Representante Legal',
};

// =====================================================================
// Test 1: createForCompany happy path — crea sign request hijo vinculado
// =====================================================================

test('signRequest.createForCompany: crea hijo vinculado al padre', () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const padreOpts = buildOpts(acuerdo, { id_documento: 'doc-firma-dual-1' });

  // El padre se crea con flag de firma dual + snapshot del representante.
  // En este RED step, create() ignora estas props (no las acepta aún) — pero
  // las pasamos para que Task 1.5 las pueda usar cuando implemente
  // createForCompany y el soporte en create().
  const padreResult = signRequestService.create({
    ...padreOpts,
    requiere_firma_empresa: 1,
    representante_legal_snapshot: REP,
  });

  const hijo = signRequestService.createForCompany({
    parent_id_solicitud: padreResult.signRequest.id_solicitud,
    id_empresa: padreOpts.id_empresa,
    id_documento: padreOpts.id_documento,
    representante: REP,
  });

  // Assertions que Task 1.5 deberá satisfacer:
  assert.ok(hijo.id_solicitud, 'hijo debe tener id_solicitud');
  assert.notStrictEqual(hijo.id_solicitud, padreResult.signRequest.id_solicitud,
    'hijo debe tener ID distinto al padre');
  assert.equal(hijo.tipo_firmante, 'EMPRESA',
    'hijo debe tener tipo_firmante=EMPRESA');
  assert.equal(hijo.parent_id_solicitud, padreResult.signRequest.id_solicitud,
    'hijo debe tener parent_id_solicitud apuntando al padre');
  assert.equal(hijo.correo_verificacion, REP.correo,
    'hijo.correo_verificacion debe ser el correo del representante');
  assert.equal(hijo.id_trabajador, null,
    'hijo no debe tener id_trabajador (es firma de la empresa)');
});

// =====================================================================
// Test 2: createForCompany falla si el padre no tiene requiere_firma_empresa=1
// =====================================================================

test('signRequest.createForCompany: falla si el padre no tiene requiere_firma_empresa=1', () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  // Padre LEGACY: NO se pasa requiere_firma_empresa (flujo tradicional).
  const padreOpts = buildOpts(acuerdo, { id_documento: 'doc-firma-dual-legacy' });
  const padreResult = signRequestService.create(padreOpts);

  // Verificar pre-condición: el padre NO tiene el flag (legacy).
  const padreRow = db.prepare(
    'SELECT requiere_firma_empresa FROM gh_firmas_electronicas WHERE id_solicitud = ?'
  ).get(padreResult.signRequest.id_solicitud);
  assert.equal(padreRow.requiere_firma_empresa, 0,
    'pre-condición: padre legacy debe tener requiere_firma_empresa=0');

  // createForCompany debe rechazar este padre con un error que mencione
  // requiere_firma_empresa (Task 1.5 define el código exacto, p.ej. AppError 400).
  let thrown = null;
  try {
    signRequestService.createForCompany({
      parent_id_solicitud: padreResult.signRequest.id_solicitud,
      id_empresa: padreOpts.id_empresa,
      id_documento: padreOpts.id_documento,
      representante: REP,
    });
  } catch (e) {
    thrown = e;
  }

  assert.ok(thrown, 'createForCompany debe lanzar error si el padre no tiene el flag');
  assert.match(thrown.message, /requiere_firma_empresa/,
    'el mensaje de error debe mencionar requiere_firma_empresa');

  // No debe haber fila de hijo en BD.
  const hijoRow = db.prepare(
    'SELECT id FROM gh_firmas_electronicas WHERE parent_id_solicitud = ?'
  ).get(padreResult.signRequest.id_solicitud);
  assert.equal(hijoRow, undefined,
    'no debe existir hijo en BD cuando el padre no tiene el flag');
});

// =====================================================================
// Test 3: createForCompany falla si ya existe un hijo (UNIQUE en parent_id_solicitud)
// =====================================================================

test('signRequest.createForCompany: falla si ya existe un hijo (UNIQUE constraint)', () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const padreOpts = buildOpts(acuerdo, { id_documento: 'doc-firma-dual-unique' });
  const padreResult = signRequestService.create({
    ...padreOpts,
    requiere_firma_empresa: 1,
    representante_legal_snapshot: REP,
  });

  // Primer createForCompany: debe tener éxito (Task 1.5).
  signRequestService.createForCompany({
    parent_id_solicitud: padreResult.signRequest.id_solicitud,
    id_empresa: padreOpts.id_empresa,
    id_documento: padreOpts.id_documento,
    representante: REP,
  });

  // Segundo createForCompany con el mismo padre: debe fallar por el
  // UNIQUE INDEX idx_gh_firmas_unico_hijo (migration 013).
  let thrown = null;
  try {
    signRequestService.createForCompany({
      parent_id_solicitud: padreResult.signRequest.id_solicitud,
      id_empresa: padreOpts.id_empresa,
      id_documento: padreOpts.id_documento,
      representante: REP,
    });
  } catch (e) {
    thrown = e;
  }

  assert.ok(thrown, 'segundo createForCompany debe lanzar error (UNIQUE)');
  // El mensaje exacto depende del wrapping de AppError que haga Task 1.5;
  // verificamos que la causa raíz mencione el índice UNIQUE o UNIQUE constraint.
  const errorText = `${thrown.message} ${thrown.cause?.message || ''}`;
  assert.match(errorText, /UNIQUE|unico_hijo|idx_gh_firmas_unico_hijo/i,
    'el error debe provenir del UNIQUE INDEX idx_gh_firmas_unico_hijo');

  // Solo debe haber 1 hijo en BD (no 2).
  const hijosCount = db.prepare(
    'SELECT COUNT(*) AS n FROM gh_firmas_electronicas WHERE parent_id_solicitud = ?'
  ).get(padreResult.signRequest.id_solicitud).n;
  assert.equal(hijosCount, 1, 'debe haber exactamente 1 hijo para el padre');
});

// =====================================================================
// Test 4 (I-AUDIT-2026-09-10): createForCompany copia el PDF original del
// padre al path del hijo, para auditoría (trazabilidad por firmante) y
// resiliencia (si el path del padre se borra, el hijo sigue teniendo su
// original). ANTES el registro del hijo apuntaba al MISMO archivo del
// padre (decisión de diseño documentada), lo que rompía la trazabilidad.
// =====================================================================

test('signRequest.createForCompany: copia el PDF original al path del hijo (I-AUDIT-2026-09-10)', () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const fs = require('fs');
  const path = require('path');
  const { PATHS } = require('../../src/services/storage');

  const padreOpts = buildOpts(acuerdo, { id_documento: 'doc-firma-dual-pdf-copy' });
  const padreResult = signRequestService.create({
    ...padreOpts,
    requiere_firma_empresa: 1,
    representante_legal_snapshot: REP,
  });

  const hijo = signRequestService.createForCompany({
    parent_id_solicitud: padreResult.signRequest.id_solicitud,
    id_empresa: padreOpts.id_empresa,
    id_documento: padreOpts.id_documento,
    representante: REP,
  });

  // 1) El path del hijo debe ser DISTINTO al del padre (cada uno en su archivo)
  const padrePath = padreResult.signRequest.pdf_original_path;
  const hijoRow = db.prepare(
    'SELECT pdf_original_path FROM gh_firmas_electronicas WHERE id_solicitud = ?'
  ).get(hijo.id_solicitud);

  assert.notStrictEqual(hijoRow.pdf_original_path, padrePath,
    'el path del hijo debe ser DISTINTO al del padre (cada uno con su archivo)');

  // 2) El path del hijo debe seguir el patrón esperado: originales/{hijo_id}.pdf
  const expectedHijoPath = path.join(PATHS.originales, `${hijo.id_solicitud}.pdf`);
  assert.equal(hijoRow.pdf_original_path, expectedHijoPath,
    'el path del hijo debe ser originales/{hijo.id_solicitud}.pdf');

  // 3) El archivo del hijo debe existir en disco
  assert.ok(fs.existsSync(hijoRow.pdf_original_path),
    `el archivo del hijo debe existir: ${hijoRow.pdf_original_path}`);

  // 4) El contenido del archivo del hijo debe ser IDÉNTICO al del padre
  const padreContent = fs.readFileSync(padrePath);
  const hijoContent = fs.readFileSync(hijoRow.pdf_original_path);
  assert.ok(padreContent.equals(hijoContent),
    'el contenido del PDF del hijo debe ser idéntico al del padre');
});
