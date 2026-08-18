/**
 * Servicio de generación de PDFs.
 *
 * - generateSignedPdf: toma el PDF original y le añade metadata
 *   de firma electronica (sin modificar el contenido visual).
 * - generateConstanciaPdf: genera un PDF nuevo con los datos
 *   de la firma como evidencia legal.
 *
 * Usa pdf-lib (declarado en package.json).
 */
'use strict';

const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const fs = require('fs');

/**
 * Toma el PDF original (Buffer) y le añade metadata de firma.
 * El contenido visual NO se modifica.
 */
async function generateSignedPdf(originalBuffer, metadata) {
  const pdfDoc = await PDFDocument.load(originalBuffer);

  // Metadata XMP
  pdfDoc.setProducer('K+AIR Firma Electrónica v1.0');
  pdfDoc.setCreator('K+AIR');
  pdfDoc.setAuthor(metadata.id_trabajador || 'trabajador');
  pdfDoc.setSubject(`Documento firmado: ${metadata.id_documento}`);
  pdfDoc.setKeywords([
    'K+AIR',
    'Firma Electrónica',
    `solicitud:${metadata.id_solicitud}`,
    `hash:${metadata.document_hash_firmado}`,
    `evidence:${metadata.evidence_hash}`,
    `fecha:${metadata.fecha_firma}`,
  ]);
  pdfDoc.setModificationDate(new Date(metadata.fecha_firma));

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

/**
 * Genera un PDF de Constancia de firma electrónica.
 * Es la evidencia legal que se entrega al firmante.
 */
async function generateConstanciaPdf(metadata) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]); // Letter size
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const lineHeight = 14;
  let y = 750;

  function drawLine(text, opts = {}) {
    page.drawText(text, {
      x: opts.x || 50,
      y,
      size: opts.size || 10,
      font: opts.bold ? fontBold : font,
      color: opts.color || rgb(0, 0, 0),
    });
    y -= lineHeight;
  }

  // Header
  drawLine('CONSTANCIA DE FIRMA ELECTRÓNICA', { bold: true, size: 14 });
  drawLine('K+AIR', { bold: true, size: 12 });
  y -= 10;

  // Documento
  drawLine('DOCUMENTO FIRMADO', { bold: true });
  drawLine(`  ID Solicitud:    ${metadata.id_solicitud}`);
  drawLine(`  ID Documento:     ${metadata.id_documento}`);
  drawLine(`  Tipo de firma:    ${metadata.tipo_firma}`);
  drawLine(`  Hash original:    ${metadata.document_hash_original}`);
  drawLine(`  Hash firmado:     ${metadata.document_hash_firmado}`);
  y -= 10;

  // Trabajador
  drawLine('TRABAJADOR', { bold: true });
  drawLine(`  ID:               ${metadata.id_trabajador}`);
  drawLine(`  Identificación:   ${metadata.identificacion_tipo || 'N/D'} (hash guardado)`);
  y -= 10;

  // Empresa
  drawLine('EMPRESA', { bold: true });
  drawLine(`  ID:               ${metadata.id_empresa}`);
  y -= 10;

  // Fecha y método
  drawLine('FECHA Y MÉTODO', { bold: true });
  drawLine(`  Fecha firma:      ${metadata.fecha_firma}`);
  drawLine(`  Mecanismo:        Firma electrónica K+AIR`);
  drawLine(`  Autenticación:    OTP al correo`);
  drawLine(`  Manifestación:    Aceptación explícita por checkbox + botón`);
  y -= 10;

  // Evidencia
  drawLine('EVIDENCIA', { bold: true });
  drawLine(`  Evidence hash:    ${metadata.evidence_hash}`);
  drawLine(`  K+AIR version:    ${metadata.version_kair}`);
  y -= 10;

  // Marco normativo
  drawLine('MARCO NORMATIVO', { bold: true });
  drawLine('  Este mecanismo está diseñado conforme a la Ley 527 de 1999,');
  drawLine('  Decreto 2364 de 2012, Decreto 1072 de 2015 (arts 2.2.1.1.8 a');
  drawLine('  2.2.1.1.13) y Decreto 526 de 2021. La validación jurídica');
  drawLine('  definitiva del mecanismo debe realizarla un profesional');
  drawLine('  jurídico colombiano antes del uso en producción.');
  y -= 10;

  // Verificación
  drawLine('VERIFICACIÓN', { bold: true });
  drawLine(`  ID de generación: ${metadata.id_constancia}`);
  y -= 20;

  // Footer
  drawLine('_____________________________________________', { x: 50 });
  drawLine('Generado automáticamente por K+AIR Firma Electrónica v1.0', {
    size: 8, color: rgb(0.5, 0.5, 0.5),
  });

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

module.exports = {
  generateSignedPdf,
  generateConstanciaPdf,
};
