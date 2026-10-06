/**
 * Tests de pdfGen — Bloque I-FIRMA-DUAL (Fase 1D, v0.1.180):
 * generateSignedPdf aceptando un array de firmas.
 *
 * Esta tarea es el RED step del TDD para que pdfGen.generateSignedPdf
 * soporte múltiples firmas en el mismo PDF. La implementación actual
 * (v0.1.179) SOLO acepta 1 firma via metadata.id_trabajador, sin
 * considerar el caso de firma dual (trabajador + empresa).
 *
 * Cubre:
 *   §1 Backward compat: SIN `firmas`, comportamiento idéntico a v0.1.179
 *      (1 original + 1 sello = 2 páginas).
 *   §2 Firma dual: CON `firmas: [...]`, agrega página visible
 *      "Constancia de firma dual" + XMP keywords con prefijos
 *      `firma_1_`, `firma_2_`.
 *
 * Decisiones validadas:
 *  - Texto de los firmantes se busca en los bytes crudos del PDF
 *    (pdf-lib no expone API de text extraction; con StandardFonts
 *    el texto ASCII queda literal en el content stream entre `(...)`).
 *  - XMP keywords se leen via `pdfDoc.getKeywords()` post-load.
 *  - El test es puro servicio — sin BD, sin HTTP.
 *
 * Scope: este test NO requiere setup.js (pdfGen no toca BD). Se ejecuta:
 *   node --test tests/services/pdfGen-firma-dual.test.js
 *
 * Estado esperado (RED step, v0.1.180 sin implementar):
 *   - Test 1 PASA (legacy funciona con la implementación actual).
 *   - Test 2 FALLA (la implementación actual no acepta `firmas`,
 *     no agrega la página de constancia dual, y los XMP keywords
 *     no tienen prefijos `firma_1_` / `firma_2_`).
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const pdfGen = require('../../src/services/pdfGen');

// =====================================================================
// Helpers
// =====================================================================

/**
 * Construye un PDF mínimo de 1 página con un poco de texto.
 * Devuelve Buffer.
 */
async function buildSimplePdf() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([612, 792]);
  page.drawText('Documento de prueba para firma dual', {
    x: 50, y: 750, size: 12, font, color: rgb(0, 0, 0),
  });
  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

// =====================================================================
// Test 1: backward compat — sin `firmas`, comportamiento idéntico a v0.1.179
// =====================================================================

test('Test 1: pdfGen sin `firmas` (legacy) — produce 2 páginas (original + sello)', async () => {
  const original = await buildSimplePdf();
  const out = await pdfGen.generateSignedPdf(original, {
    id_solicitud: 'SIGN-2026-TEST-LEGACY',
    id_documento: 'doc-legacy',
    id_trabajador: '1234567890',
    agreement_version: 'v1.0',
    fecha_firma: '2026-09-08T13:00:00Z',
  });
  assert.ok(Buffer.isBuffer(out), 'generateSignedPdf debe devolver un Buffer');
  const outPdf = await PDFDocument.load(out);
  assert.equal(
    outPdf.getPageCount(),
    2,
    'PDF firmado sin firmas: 1 original + 1 página de sello = 2 páginas'
  );
});

// =====================================================================
// Test 2: firma dual — con `firmas: [...]`, agrega constancia dual + XMP
// =====================================================================

test('Test 2: pdfGen con `firmas: [...]` (dual) — produce 3 páginas con constancia dual + XMP keywords', async () => {
  const original = await buildSimplePdf();
  const firmas = [
    {
      tipo_firmante: 'TRABAJADOR',
      nombre: 'JUAN_TRABAJADOR_TEST',
      identificacion: '1234567890',
      correo: 'juan.trabajador@test.com',
      fecha_firma: '2026-09-08T13:00:00Z',
    },
    {
      tipo_firmante: 'EMPRESA',
      nombre: 'EMPRESA_REP_LEGAL_TEST',
      identificacion: '900123456',
      correo: 'rep.legal@test.com',
      fecha_firma: '2026-09-08T13:30:00Z',
    },
  ];
  const out = await pdfGen.generateSignedPdf(original, {
    id_solicitud: 'SIGN-2026-TEST-DUAL',
    id_documento: 'doc-dual',
    agreement_version: 'v1.0',
    fecha_firma: '2026-09-08T13:00:00Z',
    firmas,
  });
  assert.ok(Buffer.isBuffer(out), 'generateSignedPdf debe devolver un Buffer');
  const outPdf = await PDFDocument.load(out);
  // 1 original + 1 sello + 1 constancia dual = 3
  assert.equal(
    outPdf.getPageCount(),
    3,
    'PDF firmado con 2 firmas: 1 original + 1 sello + 1 constancia dual = 3 páginas'
  );

  // Verifica que AMBOS firmantes aparecen en el contenido del PDF.
  // pdf-lib no expone text extraction, pero con StandardFonts.Helvetica
  // el texto ASCII queda literal en el content stream entre `(...) Tj`,
  // así que un binary search sobre los bytes funciona para nombres ASCII.
  const outBytes = await outPdf.save();
  const outBinary = Buffer.from(outBytes).toString('binary');
  assert.ok(
    outBinary.includes('JUAN_TRABAJADOR_TEST'),
    'el nombre del primer firmante debe aparecer en el contenido del PDF (Constancia de firma dual)'
  );
  assert.ok(
    outBinary.includes('EMPRESA_REP_LEGAL_TEST'),
    'el nombre del segundo firmante debe aparecer en el contenido del PDF (Constancia de firma dual)'
  );

  // Verifica que el XMP metadata lista ambas firmas con prefijos firma_1_/firma_2_.
  // pdfDoc.getKeywords() devuelve string en pdf-lib 1.17.1 (no array).
  // El string puede contener keywords separadas por coma, espacio, o cualquier delimitador.
  const keywords = outPdf.getKeywords();
  const keywordsStr = typeof keywords === 'string' ? keywords : (Array.isArray(keywords) ? keywords.join('|') : String(keywords || ''));
  assert.ok(
    /firma_1_/.test(keywordsStr),
    'XMP keywords deben incluir prefijo `firma_1_` para el primer firmante. Obtenido: ' + keywordsStr
  );
  assert.ok(
    /firma_2_/.test(keywordsStr),
    'XMP keywords deben incluir prefijo `firma_2_` para el segundo firmante. Obtenido: ' + keywordsStr
  );
});
