/**
 * Generador de la Constancia GENERAL del expediente (constancia consolidada).
 *
 * A diferencia de pdfGen.generateConstanciaPdf (1 constancia por solicitud de
 * firma), este genera UN PDF que cubre TODAS las solicitudes de firma de un
 * trabajador (expediente): resumen ejecutivo + una sección por documento con
 * sus hitos, hashes, consentimiento y trazabilidad completa.
 *
 * Diferencias deliberadas frente a la constancia individual:
 *  - La identificación del firmante se muestra COMPLETA (documento interno
 *    de la empresa, no se envía al firmante).
 *  - Se genera al vuelo (no se persiste): siempre refleja el estado actual
 *    del expediente, incluidos documentos pendientes.
 *
 * Reutiliza las helpers puras y constantes de pdfGen.js (wrapText,
 * truncHash, fmtFechaHora, EVENTO_LABEL, MARCO_LEGAL_LINEAS) y duplica el
 * patrón de layout (helpers de dibujo closures sobre page/y) para no tocar
 * el generador de la constancia individual.
 */
'use strict';

const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const {
  wrapText,
  truncHash,
  fmtFechaHora,
  EVENTO_LABEL,
  MARCO_LEGAL_LINEAS,
} = require('./pdfGen');

// Traducción de estados técnicos a etiquetas legibles para el lector.
const ESTADO_LABEL = {
  SIGNED: 'Firmado',
  DUAL_FIRMADO: 'Firmado (doble firma)',
  PENDING: 'Pendiente de envío al firmante',
  OPENED: 'En proceso — enlace abierto',
  IDENTIFICATION_STARTED: 'En proceso — identificación iniciada',
  IDENTIFIED: 'En proceso — identificado',
  OTP_SENT: 'En proceso — código enviado',
  OTP_VERIFIED: 'En proceso — código verificado',
  DOCUMENT_OPENED: 'En proceso — documento abierto',
  DOCUMENT_VIEWED: 'En proceso — documento leído',
  MANIFESTATION_RECORDED: 'En proceso — manifestación registrada',
  REJECTED: 'Rechazado por el firmante',
  EXPIRED: 'Expirado',
  REVOKED: 'Revocado',
  CANCELLED: 'Cancelado',
  OTP_LOCKED: 'Bloqueado por intentos de código',
  IDENTIFICATION_FAILED: 'Identificación fallida',
};

function estadoLabel(estado) {
  return ESTADO_LABEL[estado] || estado || 'Desconocido';
}

// Estados que cuentan como firmado (SIGNED = firma simple,
// DUAL_FIRMADO = firma de trabajador + empresa).
function esFirmado(estado) {
  return estado === 'SIGNED' || estado === 'DUAL_FIRMADO';
}

/**
 * Genera la constancia consolidada del expediente.
 *
 * @param {object} data
 *   id_consolidada: string (UUID de esta emisión)
 *   nombre_empresa: string
 *   nombre_empresa: string
 *   nit_empresa: string|null
 *   correo_empresa: string|null (correo corporativo del emisor, si está registrado)
 *   correo_emisor: string|null (desde el cual salen las invitaciones — smtp.fromEmail)
 *   trabajador: { nombre, identificacion_tipo, identificacion, correo_invitacion }
 *                 (identificación COMPLETA; correo al que salió la invitación)
 *   zona_horaria: string|null
 *   generado_en: ISO string
 *   documentos: [ { nombre_documento, id_documento, asunto_documento, id_solicitud, estado,
 *                   fecha_creacion, fecha_firma, correo_trabajador, correo_emisor,
 *                   hitos_firma: [{label,fecha_hora,estado}],
 *                   eventos: [{evento, fecha_hora, ip, user_agent, id_actor}],
 *                   eventos_total: number,
 *                   document_hash_original, document_hash_firmado, evidence_hash,
 *                   id_constancia, consent_id, fecha_aceptacion_acuerdo } ]
 *   totales: { documentos, firmados, pendientes }
 * @returns {Promise<Buffer>}
 */
async function generateConstanciaConsolidadaPdf(data) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const C = {
    primario: rgb(0.09, 0.31, 0.65),
    texto: rgb(0.12, 0.14, 0.20),
    gris: rgb(0.42, 0.46, 0.52),
    grisClaro: rgb(0.62, 0.65, 0.69),
    bandaBg: rgb(0.955, 0.96, 0.97),
    regla: rgb(0.88, 0.90, 0.92),
    verde: rgb(0.12, 0.55, 0.28),
    ambar: rgb(0.72, 0.45, 0.05),
  };

  const PAGE_W = 612, PAGE_H = 792;
  const MAR_L = 50, MAR_R = 562;
  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - 64;

  const documentos = Array.isArray(data.documentos) ? data.documentos : [];
  const totales = data.totales || {
    documentos: documentos.length,
    firmados: documentos.filter(function (d) { return esFirmado(d.estado); }).length,
    pendientes: documentos.filter(function (d) { return !esFirmado(d.estado); }).length,
  };
  const trabajador = data.trabajador || {};
  const zonaHoraria = data.zona_horaria
    || Intl.DateTimeFormat().resolvedOptions().timeZone
    || null;

  // ═══ Helpers de dibujo (closures sobre page/y/pdfDoc) ═══

  function nuevaPaginaSiBajo(minY) {
    if (y < minY) {
      page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - 64;
    }
  }

  function seccion(titulo) {
    nuevaPaginaSiBajo(120);
    y -= 6;
    page.drawRectangle({ x: MAR_L, y: y - 4, width: MAR_R - MAR_L, height: 18, color: C.bandaBg });
    page.drawText(titulo, { x: MAR_L + 8, y, size: 10, font: fontBold, color: C.primario });
    y -= 26;
  }

  function campo(label, valor, opts) {
    const o = opts || {};
    const size = o.size || 9.5;
    const labelX = MAR_L + 12;
    const valueX = MAR_L + 170;
    nuevaPaginaSiBajo(80);
    page.drawText(label, { x: labelX, y, size, font: fontBold, color: C.gris });
    const lines = wrapText(valor == null || valor === '' ? '—' : String(valor), font, size, MAR_R - valueX - 8);
    for (const ln of lines) {
      page.drawText(ln, { x: valueX, y, size, font, color: o.color || C.texto });
      y -= 13;
    }
    y -= 1;
  }

  function parrafo(texto, opts) {
    const o = opts || {};
    const size = o.size || 8.5;
    const lines = wrapText(texto, font, size, MAR_R - MAR_L - 24);
    nuevaPaginaSiBajo(80);
    for (const ln of lines) {
      page.drawText(ln, { x: MAR_L + 12, y, size, font, color: o.color || C.gris });
      y -= o.lh || 12;
    }
    y += 2;
  }

  function hito(label, fechaIso, estado) {
    const fechaTxt = fmtFechaHora(fechaIso);
    const estadoTxt = estado || 'Registrado';
    const estadoWidth = font.widthOfTextAtSize(estadoTxt, 8);
    nuevaPaginaSiBajo(70);
    page.drawText(fechaTxt, { x: MAR_L + 12, y, size: 8.5, font, color: C.gris });
    page.drawText(label || 'Hito', { x: MAR_L + 145, y, size: 9, font: fontBold, color: C.texto });
    page.drawText(estadoTxt, { x: MAR_R - estadoWidth, y, size: 8, font, color: C.gris });
    y -= 16;
  }

  // ═══ HEADER ═══
  page.drawText('K+AIR', { x: MAR_R - 90, y: PAGE_H - 56, size: 13, font: fontBold, color: C.primario });
  page.drawText('CONSTANCIA GENERAL DE FIRMA ELECTRÓNICA', { x: MAR_L, y, size: 14, font: fontBold, color: C.texto });
  y -= 14;
  page.drawText('Expediente completo del trabajador — consolidado de documentos', { x: MAR_L, y, size: 9.5, font, color: C.gris });
  y -= 18;
  page.drawLine({ start: { x: MAR_L, y }, end: { x: MAR_R, y }, thickness: 1, color: C.regla });
  y -= 18;

  // ═══ RESUMEN ═══
  seccion('Resumen del expediente');
  campo('Empresa', data.nombre_empresa || '—');
  campo('NIT', data.nit_empresa || '—');
  campo('Correo de la empresa', data.correo_empresa || '—');
  campo('Correo del emisor (invitaciones)', data.correo_emisor || '—');
  campo('Trabajador', trabajador.nombre || '—');
  campo('Identificación',
    (trabajador.identificacion_tipo ? trabajador.identificacion_tipo + ' ' : '')
    + (trabajador.identificacion || '—'));
  campo('Correo del trabajador (invitación)', trabajador.correo_invitacion || '—');
  campo('Documentos en el expediente', String(totales.documentos));
  campo('Firmados', String(totales.firmados), { color: totales.firmados > 0 ? C.verde : C.texto });
  campo('Pendientes de firma', String(totales.pendientes), { color: totales.pendientes > 0 ? C.ambar : C.texto });
  campo('Emitida', fmtFechaHora(data.generado_en));
  campo('Zona horaria de referencia', zonaHoraria || '—');
  campo('ID de esta constancia general', data.id_consolidada || '—');

  // ═══ TABLA RESUMEN DE DOCUMENTOS ═══
  seccion('Documentos del expediente (' + documentos.length + ')');
  if (documentos.length === 0) {
    parrafo('No hay solicitudes de firma registradas para este expediente.');
  }
  let idx = 1;
  for (const doc of documentos) {
    const firmado = esFirmado(doc.estado);
    nuevaPaginaSiBajo(100);
    page.drawText('#' + idx, { x: MAR_L + 2, y, size: 9, font: fontBold, color: C.gris });
    // Nombre real del documento (ej. "Contrato Laboral"); el identificador
    // interno (do-...) NO va aquí, se muestra en la sección del documento.
    const titulo = (doc.nombre_documento || doc.asunto_documento || doc.id_solicitud || 'Documento');
    const tituloLines = wrapText(titulo, fontBold, 9.5, MAR_R - MAR_L - 80);
    page.drawText(tituloLines[0], { x: MAR_L + 26, y, size: 9.5, font: fontBold, color: C.texto });
    const st = estadoLabel(doc.estado);
    const stColor = firmado ? C.verde : C.ambar;
    const stW = fontBold.widthOfTextAtSize(st, 8.5);
    page.drawText(st, { x: MAR_R - stW, y, size: 8.5, font: fontBold, color: stColor });
    y -= 13;
    page.drawText(doc.id_solicitud || '—', { x: MAR_L + 26, y, size: 8, font, color: C.gris });
    const f = doc.fecha_firma ? fmtFechaHora(doc.fecha_firma) : '—';
    const fTxt = firmado ? ('Firmado: ' + f) : ('Creada: ' + fmtFechaHora(doc.fecha_creacion));
    const fW = font.widthOfTextAtSize(fTxt, 8);
    page.drawText(fTxt, { x: MAR_R - fW, y, size: 8, font, color: C.gris });
    // Separador sutil ENTRE documentos (bajo el bloque, sin cruzar el texto)
    y -= 6;
    if (idx < documentos.length) {
      page.drawLine({ start: { x: MAR_L, y }, end: { x: MAR_R, y }, thickness: 0.5, color: C.regla });
    }
    y -= 12;
    idx += 1;
  }

  // ═══ SECCIÓN POR DOCUMENTO ═══
  idx = 1;
  for (const doc of documentos) {
    // Cada documento inicia en página nueva si el espacio restante es corto
    nuevaPaginaSiBajo(220);
    page.drawRectangle({ x: MAR_L, y: y - 4, width: MAR_R - MAR_L, height: 20, color: C.primario });
    page.drawText(
      'DOCUMENTO ' + idx + ' de ' + documentos.length,
      { x: MAR_L + 8, y: y + 1, size: 10.5, font: fontBold, color: rgb(1, 1, 1) }
    );
    y -= 34;

    campo('Documento', doc.nombre_documento || doc.asunto_documento || '—');
    if (doc.id_documento) campo('ID interno del documento', doc.id_documento);
    campo('ID de la solicitud', doc.id_solicitud || '—');
    campo('Estado', estadoLabel(doc.estado), { color: esFirmado(doc.estado) ? C.verde : C.ambar });
    campo('Correo del firmante (invitación)', doc.correo_trabajador || '—');
    campo('Correo del emisor', doc.correo_emisor || '—');
    campo('Creada', fmtFechaHora(doc.fecha_creacion));
    if (doc.fecha_firma) campo('Fecha de firma', fmtFechaHora(doc.fecha_firma));

    // --- Hitos ---
    const hitosArr = Array.isArray(doc.hitos_firma) ? doc.hitos_firma : [];
    if (hitosArr.length) {
      seccion('Hitos de la firma');
      for (const h of hitosArr) {
        hito(h.label, h.fecha_hora, h.estado);
      }
      y -= 6;
    }

    // --- Evidencia criptográfica (solo si está firmado) ---
    // FIX I-FIRMA-DUAL: la constancia individual SÍ existe para DUAL_FIRMADO
    // (se genera en commit() y se persiste en constancia_path). El handler
    // routes/constancia.js ahora expone el id_constancia para ambos estados
    // terminales; el PDF del consolidado lo imprime aquí.
    if (esFirmado(doc.estado)) {
      seccion('Evidencia criptográfica');
      campo('Hash SHA-256 (original)', truncHash(doc.document_hash_original));
      campo('Hash SHA-256 (firmado)', truncHash(doc.document_hash_firmado));
      campo('Hash de evidencia', truncHash(doc.evidence_hash));
      campo('ID de constancia individual', doc.id_constancia || '—');
    }

    // --- Firmantes (identidad de cada parte) ---
    (function () {
      var hayEmpresa = doc.firmante_empresa && (doc.firmante_empresa.nombre || doc.firmante_empresa.correo);
      if (!hayEmpresa) return;
      seccion('Firmante empresa');
      campo('Nombre', doc.firmante_empresa.nombre || '—');
      campo('Cargo', doc.firmante_empresa.cargo || '—');
      campo('Identificación', (doc.firmante_empresa.tipo_identificacion || 'CC') + ' ' + (doc.firmante_empresa.numero_identificacion || '—'));
      campo('Correo (invitación)', doc.firmante_empresa.correo || '—');
    })();

    // --- Consentimiento ---
    if (doc.consent_id) {
      var esRep = doc.consent_rol === 'EMPRESA';
      seccion(esRep ? 'Consentimiento del representante legal' : 'Consentimiento del firmante');
      campo('ID de consentimiento', doc.consent_id);
      if (doc.consent_nombre_aceptante) campo('Aceptado por', doc.consent_nombre_aceptante);
      campo('Fecha de aceptación', fmtFechaHora(doc.fecha_aceptacion_acuerdo));
      if (doc.consent_regimen_anterior) {
        parrafo('Nota: documento firmado bajo régimen anterior (consentimiento compartido con el trabajador).', { size: 8, color: C.gris });
      }
    }

    // --- Enlace de verificación (token sin efecto post-firma: solo informa estado) ---
    if (doc.url_verificacion) {
      campo('Enlace de verificación', doc.url_verificacion);
    }

    // --- Trazabilidad completa ---
    seccion('Trazabilidad de eventos' + (doc.eventos_total ? ' (' + doc.eventos_total + ')' : ''));
    const eventos = Array.isArray(doc.eventos) ? doc.eventos : [];
    if (eventos.length === 0) {
      parrafo('Sin eventos registrados para esta solicitud.');
    } else {
      for (const ev of eventos) {
        nuevaPaginaSiBajo(70);
        const label = EVENTO_LABEL[ev.evento] || ev.evento || 'Evento';
        page.drawText(fmtFechaHora(ev.fecha_hora), { x: MAR_L + 12, y, size: 8.5, font, color: C.gris });
        page.drawText(label, { x: MAR_L + 145, y, size: 9, font: fontBold, color: C.texto });
        y -= 12;
        const meta = [];
        if (ev.id_actor) meta.push('actor: ' + ev.id_actor);
        if (ev.ip) meta.push('ip: ' + ev.ip);
        if (meta.length) {
          page.drawText(meta.join('  ·  '), { x: MAR_L + 145, y, size: 7.5, font, color: C.grisClaro });
          y -= 12;
        }
        y -= 2;
      }
    }

    y -= 18;
    idx += 1;
  }

  // ═══ MARCO LEGAL ═══
  seccion('Marco legal');
  MARCO_LEGAL_LINEAS.forEach(function (l) {
    parrafo(l, { size: 8, lh: 11 });
  });
  y -= 6;

  // ═══ DECLARACIÓN DE INTEGRIDAD ═══
  seccion('Declaración de integridad');
  parrafo(
    'Esta constancia general consolida la información de ' + totales.documentos
    + ' solicitud(es) de firma electrónica del expediente identificado en el resumen. '
    + 'Cada documento firmado conserva su constancia individual independiente, que constituye '
    + 'la evidencia legal primaria de esa firma; el presente documento es una compilación '
    + 'organizada de dichas evidencias para lectura integral del expediente.',
    { size: 8.5 }
  );
  parrafo(
    'Emitida por K+AIR Firma Electrónica el ' + fmtFechaHora(data.generado_en)
    + ' · ID de emisión: ' + (data.id_consolidada || '—')
    + '. Los hashes y la trazabilidad aquí mostrados provienen de los registros '
    + 'de auditoría persistentes del sistema de firma.',
    { size: 8 }
  );

  // ═══ FOOTER simple en última página ═══
  page.drawLine({ start: { x: MAR_L, y: 60 }, end: { x: MAR_R, y: 60 }, thickness: 0.5, color: C.regla });
  page.drawText(
    'K+AIR Firma Electrónica — Constancia general del expediente. Documento informativo consolidado.',
    { x: MAR_L, y: 46, size: 7.5, font, color: C.gris }
  );
  page.drawText(
    'K+AIR actúa como encargado del tratamiento en nombre de ' + (data.nombre_empresa || 'la empresa cliente') +
    ', responsable del tratamiento (Ley 1581 de 2012).',
    { x: MAR_L, y: 36, size: 7.5, font, color: C.gris }
  );

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

module.exports = {
  generateConstanciaConsolidadaPdf,
  ESTADO_LABEL,
};
