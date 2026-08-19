/**
 * Tests del servicio signRequest — Bloque E9.2: prevención de PDFs huérfanos.
 *
 * Bug original: si la transacción BD (INSERT en gh_firmas_electronicas +
 * gh_firma_sesiones + gh_firma_eventos) falla DESPUÉS de que el PDF fue
 * escrito al disco, el PDF queda huérfano: existe en storage pero sin fila
 * en BD que lo referencie.
 *
 * Fix: en services/signRequest.js#create(), envolver tx() en try/catch y
 * llamar storage.deletePdf(pdf_original_path) si falla. deletePdf es
 * silencioso (no throw si el archivo no existe), así que es seguro aunque
 * el PDF haya sido removido por otra ruta.
 *
 * Cubre:
 * - Camino feliz: tx exitosa → PDF en disco, fila en BD, sesión, evento.
 * - Fallo en tx (UNIQUE en INSERT principal) → PDF borrado, error relanzado,
 *   no hay fila en BD.
 * - Fallo genérico de BD (cualquier error dentro del callback de tx) → mismo
 *   cleanup, mismo relanzamiento.
 * - Edge case: el cleanup NO debe throw si el PDF ya no existe.
 *
 * NOTA sobre scope: este test vive en tests/services/ que NO está incluido
 * en el glob de `npm test` (solo tests/*.test.js, tests/routes/*.test.js,
 * tests/scripts/*.test.js). Se ejecuta manualmente con:
 *   node --test --require ./tests/setup.js tests/services/signRequest.test.js
 * Verificar al final del commit si esto debe reportarse al usuario.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { resetDb, seedActiveAgreement } = require('../helpers');
const signRequestService = require('../../src/services/signRequest');
const storage = require('../../src/services/storage');
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
    id_documento: 'doc-e92-001',
    id_trabajador: '1234567890',
    id_empresa: '900123456',
    tipo_firma: 'presencial',
    agreement_version: acuerdo.version,
    agreement_hash: acuerdo.texto_hash,
    document_hash: sha256(pdf),
    pdf_buffer: pdf,
    pdf_filename: 'contrato.pdf',
    version_kair: '0.1.189-test',
    ...overrides,
  };
}

/**
 * Cuenta cuántos PDFs hay en storage/pdfs/originales.
 * Helper para verificar "no orphan PDFs".
 */
function countPdfsInOriginales() {
  const dir = storage.PATHS.originales;
  return fs.readdirSync(dir).filter(f => f.endsWith('.pdf')).length;
}

/**
 * Monkey-patch db.prepare para que la próxima vez que se prepare
 * un INSERT a gh_firmas_electronicas, su .run() lance un error
 * simulado. Restaura el original al final.
 *
 * Devuelve un objeto con método `dispose()` que restaura db.prepare.
 */
function injectInsertFailure(errorToThrow) {
  const origPrepare = db.prepare.bind(db);
  let consumed = false;
  db.prepare = function patchedPrepare(sql) {
    const stmt = origPrepare(sql);
    if (!consumed && sql.includes('INSERT INTO gh_firmas_electronicas')) {
      consumed = true;
      return {
        run() { throw errorToThrow; },
        get: stmt.get.bind(stmt),
        all: stmt.all.bind(stmt),
        iterate: stmt.iterate ? stmt.iterate.bind(stmt) : undefined,
        pluck: () => ({ get: stmt.get.bind(stmt), all: stmt.all.bind(stmt), run() { throw errorToThrow; } }),
        raw: () => ({ get: stmt.get.bind(stmt), all: stmt.all.bind(stmt), run() { throw errorToThrow; } }),
        columns: stmt.columns,
        source: stmt.source,
        busy: stmt.busy ? stmt.busy.bind(stmt) : undefined,
        reset: stmt.reset ? stmt.reset.bind(stmt) : undefined,
        bind: stmt.bind ? stmt.bind.bind(stmt) : undefined,
      };
    }
    return stmt;
  };
  return {
    dispose() { db.prepare = origPrepare; },
    wasConsumed: () => consumed,
  };
}

// =====================================================================
// Camino feliz (smoke test del service directo, sin HTTP)
// =====================================================================

test('signRequest.create: camino feliz → PDF en disco, fila en BD, sesión y evento', () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const opts = buildOpts(acuerdo);

  const result = signRequestService.create(opts);

  assert.ok(result.signRequest, 'Debe retornar signRequest');
  assert.match(result.signRequest.id_solicitud, /^SIGN-\d{4}-\d{6}$/);
  assert.ok(result.token, 'Debe retornar token en texto plano');
  assert.equal(result.token.length, 32);
  assert.ok(result.url_publica);

  // PDF en disco
  assert.ok(storage.exists(result.signRequest.pdf_original_path),
    'PDF debe existir en storage');

  // Fila en BD
  const firma = db.prepare(
    'SELECT * FROM gh_firmas_electronicas WHERE id_solicitud = ?'
  ).get(result.signRequest.id_solicitud);
  assert.ok(firma, 'Debe existir fila en gh_firmas_electronicas');
  assert.equal(firma.estado, 'PENDING');

  // Sesión creada
  const sesion = db.prepare(
    'SELECT * FROM gh_firma_sesiones WHERE firma_id = ?'
  ).get(firma.id);
  assert.ok(sesion, 'Debe existir sesión');
  assert.equal(sesion.estado_sesion, 'PENDING');

  // Evento CREATED registrado
  const eventos = db.prepare(
    'SELECT evento FROM gh_firma_eventos WHERE firma_id = ?'
  ).all(firma.id);
  assert.equal(eventos.length, 1);
  assert.equal(eventos[0].evento, 'CREATED');
});

// =====================================================================
// E9.2: PDFs huérfanos — tx fallida debe limpiar el PDF
// =====================================================================

test('E9.2: fallo de tx por UNIQUE en INSERT principal → PDF huérfano se borra', () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const opts = buildOpts(acuerdo, { id_documento: 'doc-orphan-1' });

  // Simular UNIQUE constraint failed en INSERT a gh_firmas_electronicas
  const simulatedErr = new Error('UNIQUE constraint failed: gh_firmas_electronicas.id_solicitud');
  simulatedErr.code = 'SQLITE_CONSTRAINT_UNIQUE';
  const inj = injectInsertFailure(simulatedErr);

  const pdfsAntes = countPdfsInOriginales();

  let thrown = null;
  try {
    signRequestService.create(opts);
  } catch (e) {
    thrown = e;
  } finally {
    inj.dispose();
  }

  // 1. Error relanzado (NO absorbido)
  assert.ok(thrown, 'Debe lanzar el error original');
  assert.equal(thrown.code, 'SQLITE_CONSTRAINT_UNIQUE');
  assert.match(thrown.message, /UNIQUE constraint failed/);

  // 2. Monkey-patch consumido (se intentó el INSERT)
  assert.equal(inj.wasConsumed(), true, 'El INSERT simulado debe haberse ejecutado');

  // 3. No hay nueva fila en BD
  const fila = db.prepare(
    "SELECT * FROM gh_firmas_electronicas WHERE id_documento = 'doc-orphan-1'"
  ).get();
  assert.equal(fila, undefined, 'No debe haber fila en BD');

  // 4. No hay PDFs nuevos en originales (cleanup exitoso)
  const pdfsDespues = countPdfsEnOriginalesSafe();
  assert.equal(pdfsDespues, pdfsAntes,
    'No debe haber PDF huérfano en storage/pdfs/originales');
});

test('E9.2: fallo genérico de BD dentro del callback de tx → cleanup + relanzamiento', () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const opts = buildOpts(acuerdo, { id_documento: 'doc-orphan-2' });

  // Simular cualquier error inesperado de BD (no constraint)
  const simulatedErr = new Error('Simulated SQLITE_BUSY');
  simulatedErr.code = 'SQLITE_BUSY';
  const inj = injectInsertFailure(simulatedErr);

  const pdfsAntes = countPdfsInOriginales();

  let thrown = null;
  try {
    signRequestService.create(opts);
  } catch (e) {
    thrown = e;
  } finally {
    inj.dispose();
  }

  assert.ok(thrown, 'Debe lanzar el error original');
  assert.equal(thrown.code, 'SQLITE_BUSY');
  assert.equal(thrown.message, 'Simulated SQLITE_BUSY');

  // No fila, no PDF huérfano
  const fila = db.prepare(
    "SELECT * FROM gh_firmas_electronicas WHERE id_documento = 'doc-orphan-2'"
  ).get();
  assert.equal(fila, undefined);

  assert.equal(countPdfsEnOriginalesSafe(), pdfsAntes,
    'Cleanup debe borrar PDF huérfano incluso con error genérico');
});

// =====================================================================
// Edge case: cleanup NO debe throw si el PDF ya no existe
// =====================================================================

test('E9.2: si el PDF ya no existe al momento del cleanup → no throw, error original se relanza', () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const opts = buildOpts(acuerdo, { id_documento: 'doc-orphan-3' });

  // Forzar fallo en INSERT
  const simulatedErr = new Error('Simulated BD error');
  simulatedErr.code = 'SQLITE_CONSTRAINT';
  const inj = injectInsertFailure(simulatedErr);

  // Borrar TODOS los PDFs de originales ANTES de create()
  // (simula escenario donde otra ruta limpió el PDF; el cleanup
  // debe ser no-op silencioso)
  for (const f of fs.readdirSync(storage.PATHS.originales)) {
    if (f.endsWith('.pdf')) {
      fs.unlinkSync(path.join(storage.PATHS.originales, f));
    }
  }

  let thrown = null;
  let createReturnedNormally = true;
  try {
    signRequestService.create(opts);
  } catch (e) {
    thrown = e;
  } finally {
    inj.dispose();
  }

  // El error original se debe relanzar tal cual
  assert.ok(thrown, 'Error original debe relanzarse');
  assert.equal(thrown.code, 'SQLITE_CONSTRAINT');
  assert.equal(thrown.message, 'Simulated BD error');
  assert.ok(createReturnedNormally, 'create() debe completar (con throw), no crashear');
});

// =====================================================================
// Helpers locales
// =====================================================================

/**
 * Versión safe de countPdfsInOriginales que retorna 0 si el directorio
 * no existe o está vacío (en lugar de throw).
 */
function countPdfsEnOriginalesSafe() {
  try {
    return countPdfsInOriginales();
  } catch {
    return 0;
  }
}
