/**
 * EL "REGISTRO DE FIRMA AUTOGRÁFICA" (la 9A, el 7.2)
 * ====================================================
 *
 * QUÉ ES
 * -------
 * La firma electrónica deja una **Constancia de firma electrónica**: el
 * documento de evidencia con los datos del acto (quién, cuándo, con qué
 * huella, contra qué versión del Acuerdo). La firma autográfica sobre
 * soporte papel no puede dejar una Constancia igual: no hay un PDF al que
 * sellarle una página, porque el documento firmado es de papel.
 *
 * Este generador produce el equivalente: el **Registro de firma
 * autográfica**, un PDF de UNA página que registra los HECHOS del acto:
 *
 *   - qué documento se firmó (su huella SHA-256, calculada por el
 *     servidor sobre el PDF que la Empresa escaneó);
 *   - quién lo firmó (la identificación parcial del Trabajador);
 *   - cuándo lo firmó;
 *   - quién lo registró (el operador de la Empresa);
 *   - contra qué versión del Acuerdo se firmó, y su huella.
 *
 * QUÉ NO HACE (y por qué importa)
 * --------------------------------
 * NO inventa efectos jurídicos. El Registro NO dice que la firma valga: eso
 * lo dice la ley y lo recoge el numeral 7.2 del Acuerdo, que se cita
 * VERBATIM. El Registro cita; no concluye.
 *
 * La diferencia con la Constancia electrónica es real y hay que entenderla:
 * en la firma electrónica, la Constancia es lo que prueba el acto; en la
 * firma autográfica, la prueba es el documento firmado en papel. El
 * Registro es el asiento de lo que el sistema sabe del acto, no su
 * fundamento.
 *
 * Tests: tests/n9a-medios-y-papel.test.js
 */
'use strict';

const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const { wrapText, truncHash, fmtFechaHora } = require('./pdfGen');

/**
 * Genera el PDF del Registro de firma autográfica.
 *
 * @param {object} datos
 * @param {string} datos.id_solicitud
 * @param {string} [datos.id_documento]
 * @param {string} [datos.razon_social] - la Empresa que solicitó la firma
 * @param {string} [datos.nit]
 * @param {string} [datos.identificacion_parcial] - p. ej. 'CC •••• 7890'
 * @param {string} [datos.tipo_identificacion]
 * @param {string} [datos.fecha_firma] - ISO
 * @param {string} [datos.pdf_hash] - SHA-256 del documento firmado en papel
 * @param {string} [datos.pdf_hash_original] - SHA-256 del documento ORIGINAL
 *   (el que se envía a firma). La pareja de huellas es lo que ata el papel
 *   al documento: el papel firmado no puede tener la misma huella que el
 *   original (está firmado a mano), así que el vínculo tiene que ser
 *   expréso.
 * @param {string} [datos.version_kair] - la versión del Acuerdo aceptada
 * @param {string} [datos.acuerdo_hash] - la huella del texto del Acuerdo
 * @param {string} [datos.id_actor] - el operador que lo registró
 * @param {string} [datos.fecha_registro] - ISO
 * @returns {Promise<Buffer>}
 */
async function generateRegistroFirmaAutografica(datos) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const C = {
    primario: rgb(0.09, 0.31, 0.65),
    texto: rgb(0.12, 0.14, 0.20),
    gris: rgb(0.42, 0.46, 0.52),
    grisClaro: rgb(0.62, 0.65, 0.69),
    bandaBg: rgb(0.955, 0.96, 0.97),
  };

  const PAGE_W = 612, PAGE_H = 792;
  const MAR_L = 50, MAR_R = 562;
  const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - 64;

  function seccion(titulo) {
    y -= 6;
    page.drawRectangle({ x: MAR_L, y: y - 4, width: MAR_R - MAR_L, height: 18, color: C.bandaBg });
    page.drawText(titulo, { x: MAR_L + 8, y, size: 10, font: fontBold, color: C.primario });
    y -= 26;
  }

  function campo(label, valor) {
    const size = 9.5;
    const labelX = MAR_L + 12;
    const valueX = MAR_L + 170;
    page.drawText(label, { x: labelX, y, size, font: fontBold, color: C.gris });
    const lines = wrapText(valor == null || valor === '' ? '—' : String(valor), font, size, MAR_R - valueX - 8);
    for (const ln of lines) {
      page.drawText(ln, { x: valueX, y, size, font, color: C.texto });
      y -= 13;
    }
    y -= 1;
  }

  function parrafo(texto, opts) {
    const o = opts || {};
    const size = o.size || 8.5;
    const lines = wrapText(texto, font, size, MAR_R - MAR_L - 24);
    for (const ln of lines) {
      page.drawText(ln, { x: MAR_L + 12, y, size, font, color: o.color || C.gris });
      y -= o.lh || 12;
    }
    y += 2;
  }

  // ═══ HEADER ═══
  page.drawText('K+AIR', { x: MAR_R - 90, y: PAGE_H - 56, size: 13, font: fontBold, color: C.primario });
  page.drawText('REGISTRO DE FIRMA AUTOGRÁFICA', { x: MAR_L, y, size: 16, font: fontBold, color: C.texto });
  y -= 16;
  page.drawText('Acta de registro de la firma autográfica sobre soporte papel — Acuerdo de uso, numeral 7.2', {
    x: MAR_L, y, size: 9, font, color: C.grisClaro
  });
  y -= 14;
  page.drawLine({ start: { x: MAR_L, y }, end: { x: MAR_R, y }, thickness: 1.2, color: C.primario });
  y -= 10;

  // ═══ EL DOCUMENTO ═══
  seccion('El documento');
  campo('ID de solicitud', datos.id_solicitud);
  campo('ID de documento', datos.id_documento);
  campo('Huella del documento firmado', truncHash(datos.pdf_hash));
  campo('Huella del documento original', truncHash(datos.pdf_hash_original));
  campo('Versión del Acuerdo', datos.version_kair);
  campo('Huella del Acuerdo', truncHash(datos.acuerdo_hash));

  // ═══ QUIÉN Y CUÁNDO ═══
  seccion('La firma');
  campo('Identificación del Trabajador', datos.identificacion_parcial);
  campo('Fecha de la firma en papel', fmtFechaHora(datos.fecha_firma));
  campo('Registrada por', datos.id_actor);
  campo('Registrada el', fmtFechaHora(datos.fecha_registro));

  // ═══ LA EMPRESA ═══
  seccion('La Empresa');
  campo('Razón social', datos.razon_social);
  campo('NIT', datos.nit);

  // ═══ MARCO: se CITA el Acuerdo, no se concluye ═══
  seccion('Marco del Acuerdo de uso');
  parrafo(
    '"El Trabajador tiene derecho a que la Empresa le provea la firma de forma '
    + 'autográfica, sobre soporte papel, en todo momento y sin costo alguno, y a que '
    + 'el documento así firmado tenga la misma validez y efectos que el firmado '
    + 'electrónicamente." (Acuerdo sobre el uso del mecanismo de firma electrónica '
    + 'de K+AIR, numeral 7.2.)'
  );
  parrafo(
    '"La imposibilidad de firmar electrónicamente un documento no será una barrera '
    + 'de acceso al empleo, no habilitará a la Empresa para iniciar procedimiento '
    + 'disciplinario alguno por el solo hecho de que el Trabajador no utilice este '
    + 'mecanismo, y no será causa de terminación de la relación laboral." '
    + '(Acuerdo, numeral 7.3.)'
  );
  parrafo(
    'Este documento registra los hechos de la firma autográfica y de su '
    + 'inscripción en el sistema. La validez y los efectos del documento firmado '
    + 'autográficamente son los que le correspondan por ley, según el numeral 7.2 '
    + 'del Acuerdo citado.',
    { color: C.grisClaro }
  );

  return Buffer.from(await pdfDoc.save());
}

module.exports = { generateRegistroFirmaAutografica };
