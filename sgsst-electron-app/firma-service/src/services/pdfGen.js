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

// Texto legal compartido entre la página de sello y la Constancia.
// Fuente de verdad normativa: Ley 527/1999 + Decreto 1074/2015 (Cap. 47,
// compila Decreto 2364/2012) + Decreto 526/2021 (arts. 2.2.1.1.8–15 del
// D.1072/2015, firma electrónica del contrato de trabajo) + CGP Ley
// 1564/2012 arts. 243–247 + Ley 1581/2012 (datos personales).
const MARCO_LEGAL_LINEAS = [
  'Ley 527 de 1999 — Ley Marco de comercio electrónico.',
  'Decreto 1074 de 2015, Cap. 47 (arts. 2.2.2.47.1 a 2.2.2.47.10)',
  '  — Régimen de la firma electrónica (compila el Decreto 2364 de 2012).',
  'Decreto 526 de 2021 — Arts. 2.2.1.1.8 a 2.2.1.1.15 del Decreto 1072 de',
  '  2015: firma electrónica del contrato individual de trabajo.',
  'Ley 1564 de 2012 (C.G.P.), arts. 243-247 — Presunción de autenticidad',
  '  de los mensajes de datos como medio de prueba.',
  'Ley 1581 de 2012 y Decreto 1377 de 2013 — Protección de datos personales.',
];

/**
 * Agrega la página de sello visible al final del PDF firmado.
 * Hace la evidencia "legible a ojo humano": un inspector o un juez que abra
 * el PDF ve inmediatamente quién firmó, cuándo, cómo y bajo qué norma.
 */
async function addSelloPage(pdfDoc, metadata) {
  const page = pdfDoc.addPage([612, 792]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const gris = rgb(0.35, 0.35, 0.35);
  const azul = rgb(0.09, 0.31, 0.65);
  let y = 720;

  function line(text, opts = {}) {
    page.drawText(text, {
      x: opts.x || 60, y,
      size: opts.size || 10,
      font: opts.bold ? fontBold : font,
      color: opts.color || rgb(0, 0, 0),
    });
    y -= opts.lh || 16;
  }

  // Encabezado
  line('=========================================================================', { color: azul, lh: 20 });
  line('DOCUMENTO FIRMADO ELECTRONICAMENTE', { x: 60, bold: true, size: 15, color: azul, lh: 22 });
  line('=========================================================================', { color: azul, lh: 26 });

  line(`Firmante:        ${metadata.id_trabajador}`, { bold: true });
  line(`Documento:       ${metadata.id_documento}`);
  line(`ID Solicitud:    ${metadata.id_solicitud}`);
  line(`Fecha de firma:  ${metadata.fecha_firma}`);
  line(`Método:          Verificación por correo electrónico (OTP)`);
  line('                 + manifestación expresa de voluntad', {});
  y -= 6;
  line(`Versión acuerdo: ${metadata.agreement_version || 'legacy'}`, { color: gris });
  y -= 12;

  line('MARCO LEGAL', { bold: true, color: azul, lh: 18 });
  MARCO_LEGAL_LINEAS.forEach(function (l) { line('  ' + l.trim(), { size: 8.5, color: gris, lh: 12 }); });
  y -= 12;

  line('EVIDENCIA TÉCNICA', { bold: true, color: azul, lh: 18 });
  line('La Constancia de Firma asociada (archivo independiente) contiene', { size: 9, color: gris, lh: 13 });
  line('la pista de auditoría completa: hashes SHA-256 del documento,', { size: 9, color: gris, lh: 13 });
  line('evidencia, IP del firmante y trazabilidad de eventos.', { size: 9, color: gris, lh: 18 });
  y -= 10;

  line('-------------------------------------------------------------------------', { color: gris, lh: 14 });
  line('Generado por K+AIR Firma Electrónica v1.0 — El contenido original de este', { size: 8, color: gris, lh: 11 });
  line('documento (páginas anteriores) NO fue modificado por el proceso de firma.', { size: 8, color: gris });
}

/**
 * Toma el PDF original (Buffer), le agrega la página de sello visible
 * y le añade metadata XMP de firma electrónica.
 *
 * IMPORTANTE: los keywords XMP NO incluyen `document_hash_firmado` ni
 * `evidence_hash` por una razón técnica: ambos dependen del buffer final
 * del PDF firmado (chicken-and-egg). Se calculan DESPUÉS de generar el
 * PDF y se persisten en la BD, no en el XMP del archivo. El XMP incluye
 * solo metadatos verificables visualmente: id_solicitud, agreement_version,
 * fecha_firma, id_trabajador.
 *
 * @param {Buffer} originalBuffer
 * @param {object} metadata - { id_solicitud, id_documento, id_trabajador,
 *                              agreement_version, fecha_firma }
 * @returns {Promise<Buffer>}
 */
async function generateSignedPdf(originalBuffer, metadata) {
  const pdfDoc = await PDFDocument.load(originalBuffer);

  // Página de sello visible (antes de guardar, para que quede embebida)
  await addSelloPage(pdfDoc, metadata);

  // Metadata XMP (solo datos verificables; los hashes van en BD)
  pdfDoc.setProducer('K+AIR Firma Electrónica v1.0');
  pdfDoc.setCreator('K+AIR');
  pdfDoc.setAuthor(metadata.id_trabajador || 'trabajador');
  pdfDoc.setSubject(`Documento firmado: ${metadata.id_documento}`);
  pdfDoc.setKeywords([
    'K+AIR',
    'Firma Electrónica',
    `solicitud:${metadata.id_solicitud}`,
    `documento:${metadata.id_documento}`,
    `acuerdo:${metadata.agreement_version || 'legacy'}`,
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

  // Wrap de texto: pdf-lib no tiene auto-wrap; partir por palabras al
  // ancho máximo disponible (en caracteres aprox).
  function wrapText(text, maxChars) {
    const words = String(text).split(' ');
    const lines = [];
    let current = '';
    for (const w of words) {
      if ((current + ' ' + w).trim().length <= maxChars) {
        current = (current + ' ' + w).trim();
      } else {
        if (current) lines.push(current);
        current = w;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  const MAX_X = 612 - 50; // margen derecho en x=50
  const lineHeight = 14;
  let y = 750;

  function drawLine(text, opts = {}) {
    // Helvet ~ 10pt ≈ ~5.1px por char. maxChars conservador para tamaño.
    const maxChars = opts.maxChars || Math.floor((612 - 100) / 5.2);
    const indent = opts.x || 50;
    const lines = wrapText(text, maxChars);
    for (const ln of lines) {
      page.drawText(ln, {
        x: indent, y,
        size: opts.size || 10,
        font: opts.bold ? fontBold : font,
        color: opts.color || rgb(0, 0, 0),
      });
      y -= opts.lh || lineHeight;
    }
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
  drawLine('TRABAJADOR (FIRMANTE)', { bold: true });
  drawLine(`  Nombre completo:  ${metadata.nombre_trabajador || 'N/D (no proporcionado)'}`);
  drawLine(`  Identificación:   ${metadata.identificacion_tipo || 'N/D'} (hash guardado)`);
  drawLine(`  Correo:           ${metadata.correo_trabajador || 'N/D (no proporcionado)'}`);
  y -= 10;

  // Empresa
  drawLine('EMPRESA (REQUIRENTE)', { bold: true });
  drawLine(`  Nombre:           ${metadata.nombre_empresa || 'N/D (no proporcionado)'}`);
  drawLine(`  ID / NIT:         ${metadata.id_empresa}`);
  drawLine(`  Correo de envío:  ${metadata.correo_emisor || 'N/D (no configurado)'}`);
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

  // Marco normativo (con wrapControl para que no se desborde)
  drawLine('MARCO LEGAL', { bold: true });
  MARCO_LEGAL_LINEAS.forEach(function (l) {
    drawLine(l.trim(), { size: 8 });
  });
  drawLine('La validación jurídica definitiva del mecanismo corresponde al', { size: 8 });
  drawLine('operador jurídico del empleador en su implementación concreta.', { size: 8 });
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
