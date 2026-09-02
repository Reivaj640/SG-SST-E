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
// Nombre legible (es-CO, registro legal) para cada tipo de evento de
// auditoría (gh_firma_eventos.evento). Espejo del mapa del frontend
// modules/gestion-humana/firma-electronica/index.js _EVENTO_LABELS, sin
// iconos (el PDF es plano).
const EVENTO_LABEL = {
  CREATED: 'Solicitud creada',
  INVITE_SENT: 'Invitación enviada por correo',
  INVITE_RESENT: 'Invitación reenviada',
  LINK_RETRIEVED: 'Enlace de firma consultado',
  OPENED: 'Documento abierto',
  IDENTIFICATION_STARTED: 'Identificación iniciada',
  IDENTIFIED: 'Identificación completada',
  IDENTIFICATION_COMPLETED: 'Identificación completada',
  IDENTIFICATION_FAILED: 'Identificación fallida',
  OTP_SENT: 'Código de verificación enviado',
  OTP_RESENT: 'Código de verificación reenviado',
  OTP_VERIFIED: 'Código verificado',
  OTP_LOCKED: 'Código bloqueado por intentos',
  DOCUMENT_OPENED: 'Documento visualizado',
  DOCUMENT_VIEWED: 'Documento leído completo',
  CONSENT_ACCEPTED: 'Acuerdo de firma electrónica aceptado',
  MANIFESTATION_RECORDED: 'Manifestación de voluntad registrada',
  SIGN_COMMITTED: 'Firma confirmada',
  PDF_GENERATED: 'PDF firmado generado',
  COPY_SENT: 'Copia firmada enviada por correo',
  COPY_FAILED: 'Falla al enviar copia firmada',
  REJECTED: 'Firma rechazada por el firmante',
  EXPIRED: 'Solicitud expirada',
  REVOKED: 'Solicitud revocada',
  CANCELLED: 'Solicitud cancelada',
};

const MARCO_LEGAL_LINEAS = [
  'Ley 527 de 1999 — Ley Marco de comercio electrónico.',
  'Decreto 1074 de 2015, Cap. 47 (arts. 2.2.2.47.1 a 2.2.2.47.10) — Régimen de la firma electrónica (compila el Decreto 2364 de 2012).',
  'Decreto 526 de 2021 — Arts. 2.2.1.1.8 a 2.2.1.1.15 del Decreto 1072 de 2015: firma electrónica del contrato individual de trabajo.',
  'Ley 1564 de 2012 (C.G.P.), arts. 243-247 — Presunción de autenticidad de los mensajes de datos como medio de prueba.',
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
 * Layout inspirado en certificados de DocuSign: secciones con banda gris,
 * pares label:valor alineados, hashes criptográficos truncados, footer.
 */
async function generateConstanciaPdf(metadata) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Paleta (pdf-lib rgb 0-1)
  const C = {
    primario: rgb(0.09, 0.31, 0.65),   // azul marca
    texto: rgb(0.12, 0.14, 0.20),
    gris: rgb(0.42, 0.46, 0.52),
    grisClaro: rgb(0.62, 0.65, 0.69),
    bandaBg: rgb(0.955, 0.96, 0.97),   // #f3f4f6 aprox
    regla: rgb(0.88, 0.90, 0.92),
  };

  const PAGE_W = 612, PAGE_H = 792;
  const MAR_L = 50, MAR_R = 562; // content width 512
  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - 64;

  // ═══ Helpers ═══

  function nuevaPaginaSiBajo(minY) {
    if (y < minY) {
      page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - 64;
    }
  }

  // Texto con wrap por ancho real (font.widthOfTextAtSize)
  function wrapText(text, fnt, size, maxWidth) {
    const words = String(text).split(/\s+/);
    const lines = [];
    let cur = '';
    for (const w of words) {
      const test = cur ? cur + ' ' + w : w;
      if (fnt.widthOfTextAtSize(test, size) <= maxWidth) {
        cur = test;
      } else {
        if (cur) lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
    return lines.length ? lines : [''];
  }

  // Trunca hash largo: primeros 24 + '…' + últimos 24
  function truncHash(h) {
    if (!h) return 'N/D';
    const s = String(h);
    if (s.length <= 50) return s;
    return s.slice(0, 24) + '…' + s.slice(-24);
  }

  // Trunca User-Agent (largo) a N chars para que entre en una línea.
  function truncUA(ua, maxLen) {
    if (!ua) return 'N/D';
    const s = String(ua);
    const lim = maxLen || 90;
    if (s.length <= lim) return s;
    return s.slice(0, lim - 1) + '…';
  }

  // ISO → 'DD/MM/YYYY, HH:mm:ss' (hora local del servidor; la precisión
  // legal la da el ISO crudo en BD, la constancia es la lectura humana).
  function fmtFechaHora(iso) {
    if (!iso) return 'N/D';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    const p = (n) => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}, `
      + `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }

  // Banda de sección: rect gris + texto bold
  function seccion(titulo) {
    nuevaPaginaSiBajo(120);
    y -= 6;
    page.drawRectangle({ x: MAR_L, y: y - 4, width: MAR_R - MAR_L, height: 18, color: C.bandaBg });
    page.drawText(titulo, { x: MAR_L + 8, y, size: 10, font: fontBold, color: C.primario });
    y -= 26;
  }

  // Par label:valor con alineación (label bold a la izquierda, valor con wrap)
  function campo(label, valor, opts = {}) {
    const size = opts.size || 9.5;
    const labelX = MAR_L + 12;
    const valueX = MAR_L + 170; // columna fija estilo formulario
    const labelText = label;
    nuevaPaginaSiBajo(80);
    page.drawText(labelText, { x: labelX, y, size, font: fontBold, color: C.gris });
    const lines = wrapText(valor == null || valor === '' ? '—' : String(valor), font, size, MAR_R - valueX - 8);
    for (const ln of lines) {
      page.drawText(ln, { x: valueX, y, size, font, color: C.texto });
      y -= 13;
    }
    y -= 1;
  }

  // Párrafo de texto plano con wrap (para marco legal y declaración)
  function parrafo(texto, opts = {}) {
    const size = opts.size || 8.5;
    const lines = wrapText(texto, font, size, MAR_R - MAR_L - 24);
    nuevaPaginaSiBajo(80);
    for (const ln of lines) {
      page.drawText(ln, { x: MAR_L + 12, y, size, font, color: opts.color || C.gris });
      y -= opts.lh || 12;
    }
    y += 2;
  }

  // ═══ HEADER: marca + título ═══
  page.drawText('K+AIR', { x: MAR_R - 90, y: PAGE_H - 56, size: 13, font: fontBold, color: C.primario });
  page.drawText('CONSTANCIA DE FIRMA ELECTRÓNICA', { x: MAR_L, y, size: 16, font: fontBold, color: C.texto });
  y -= 16;
  page.drawText('Documento de evidencia de firma electrónica — Ley 527 de 1999', {
    x: MAR_L, y, size: 9, font, color: C.grisClaro
  });
  y -= 14;
  page.drawLine({
    start: { x: MAR_L, y }, end: { x: MAR_R, y },
    thickness: 1.2, color: C.primario,
  });
  y -= 10;

  // ═══ RESUMEN ═══
  seccion('Resumen');
  campo('ID de Solicitud', metadata.id_solicitud);
  campo('Documento', metadata.id_documento);
  campo('Estado', 'Completado — firmado electrónicamente');
  campo('Tipo de firma', metadata.tipo_firma === 'remoto' ? 'Remota (verificación OTP por correo)' : metadata.tipo_firma);
  campo('Fecha de firma', metadata.fecha_firma, {});

  // ═══ FIRMANTE ═══
  seccion('Firmante');
  campo('Nombre completo', metadata.nombre_trabajador);
  campo('Identificación', (metadata.identificacion_tipo ? metadata.identificacion_tipo + ' ' : '') + '(número protegido — hash en evidencia)');
  campo('Correo verificado', metadata.correo_trabajador);

  // ═══ EMPRESA ═══
  seccion('Empresa requirente');
  campo('Razón social', metadata.nombre_empresa);
  campo('NIT / ID', metadata.id_empresa);
  campo('Correo de envío', metadata.correo_emisor);

  // ═══ VERIFICACIÓN CRIPTOGRÁFICA ═══
  seccion('Verificación criptográfica');
  campo('Hash doc. original (SHA-256)', truncHash(metadata.document_hash_original));
  campo('Hash doc. firmado (SHA-256)', truncHash(metadata.document_hash_firmado));
  campo('Hash de evidencia (auditoría)', truncHash(metadata.evidence_hash));
  campo('IP del firmante', metadata.ip_origen || 'N/D');
  campo('Dispositivo del firmante', truncUA(metadata.user_agent));
  parrafo('Cualquier modificación posterior al PDF firmado produce un hash distinto y es detectable contra estos valores.', { size: 8, color: C.grisClaro });

  // ═══ DECLARACIÓN DEL FIRMANTE ═══
  seccion('Manifestación de voluntad del firmante');
  parrafo(metadata.manifestacion_voluntad_texto ||
    'El firmante aceptó expresamente el contenido y el método de firma electrónica.',
    { size: 9, color: C.texto });

  // ═══ MARCO LEGAL ═══
  seccion('Marco legal');
  MARCO_LEGAL_LINEAS.forEach(function (l, i) {
    parrafo(l, { size: 9, color: C.texto });
    if (i < MARCO_LEGAL_LINEAS.length - 1) y -= 2;
  });
  parrafo('La validación jurídica definitiva del mecanismo corresponde al operador jurídico del empleador en su implementación concreta.', { size: 8, color: C.grisClaro, lh: 11 });

  // ═══ AUDITORÍA / TRAZABILIDAD DE EVENTOS ═══
  // Línea de tiempo de gh_firma_eventos (append-only). Si hay más de 20,
  // el caller envía los primeros ~10 (contexto inicial) y los últimos ~10
  // (cierre de la firma) para mantener el PDF en 1-2 páginas; el historial
  // completo queda en la BD / endpoint interno de auditoría.
  const eventos = Array.isArray(metadata.eventos) ? metadata.eventos : [];
  const totalEventos = metadata.eventos_total != null ? metadata.eventos_total : eventos.length;
  seccion('Auditoría / Trazabilidad de eventos (' + totalEventos + ')');
  if (eventos.length === 0) {
    parrafo('No hay eventos registrados para esta solicitud.', { size: 9, color: C.texto });
  } else {
    if (totalEventos > eventos.length) {
      parrafo('Se muestran los ' + eventos.length + ' eventos principales (primeros y últimos de la línea de tiempo); '
        + 'los ' + (totalEventos - eventos.length) + ' eventos intermedios quedan conservados en el registro de auditoría interno.',
        { size: 8, color: C.grisClaro, lh: 11 });
      y -= 2;
    }
    eventos.forEach(function (ev) {
      const label = EVENTO_LABEL[ev.evento] || ev.evento;
      const meta = 'actor: ' + (ev.id_actor || 'sistema') + ' · IP: ' + (ev.ip || 'N/D');
      nuevaPaginaSiBajo(70);
      page.drawText(fmtFechaHora(ev.fecha_hora), { x: MAR_L + 12, y, size: 9, font, color: C.gris });
      page.drawText(label, { x: MAR_L + 140, y, size: 9, font: fontBold, color: C.texto });
      y -= 12;
      page.drawText(meta, { x: MAR_L + 140, y, size: 8, font, color: C.grisClaro });
      y -= 14;
    });
  }

  // ═══ FOOTER ═══
  nuevaPaginaSiBajo(70);
  y = Math.min(y, 70);
  page.drawLine({ start: { x: MAR_L, y }, end: { x: MAR_R, y }, thickness: 0.8, color: C.regla });
  y -= 12;
  page.drawText('ID de esta constancia: ' + metadata.id_constancia, { x: MAR_L, y, size: 8, font, color: C.grisClaro });
  y -= 12;
  page.drawText('Generado automáticamente por K+AIR Firma Electrónica · K+AIR ' + (metadata.version_kair || ''), {
    x: MAR_L, y, size: 8, font, color: C.grisClaro
  });

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

module.exports = {
  generateSignedPdf,
  generateConstanciaPdf,
};
