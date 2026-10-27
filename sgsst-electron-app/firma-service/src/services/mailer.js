/**
 * Mailer — abstracción de envío de correos.
 *
 * - En producción: usa nodemailer con SMTP configurado.
 * - En desarrollo: loguea en consola con marker [DEV-OTP] y guarda
 *   en una cola interna accesible para tests.
 *
 * Esta abstracción permite que los tests capturen los OTPs enviados
 * sin necesidad de un servidor SMTP real.
 */
'use strict';

const config = require('../config');
const logger = require('../utils/logger');
const fs = require('fs');
const crypto = require('crypto');

let _transporter = null;
let _devInbox = []; // solo en dev, contiene últimos envíos

function getTransporter() {
  if (_transporter) return _transporter;

  if (config.env === 'production') {
    // Lazy require para no cargar nodemailer en dev si no se usa
    const nodemailer = require('nodemailer');
    _transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
    });
    return _transporter;
  }

  // Dev: usar JSON transport (no envía nada, solo loguea)
  const nodemailer = require('nodemailer');
  _transporter = nodemailer.createTransport({
    jsonTransport: true,
  });
  return _transporter;
}

/**
 * Envía la copia del documento firmado EN PAPEL al medio que el Trabajador
 * autorizó (el 8.2).
 *
 * Esta es la ÚNICA ruta en la que el archivo viaja por correo, y es a
 * propósito: en la firma en papel el documento se firmó a mano, el flujo
 * electrónico de esa solicitud queda CANCELLED y el Trabajador no tiene
 * cuenta ni enlace con el que bajar nada. El medio que él autorizó es el
 * correo, así que el archivo tiene que ir adjunto.
 *
 * La firma electrónica NO usa esta función: su copia se entrega por el
 * enlace de firma (el 5.4 del Acuerdo de uso) y el correo es solo un aviso,
 * sin adjuntos. Ver `sendCopiaAviso`.
 *
 * - Producción: nodemailer con SMTP + attachments reales.
 * - Dev: nodemailer jsonTransport (no envía), pero los attachments
 *   se persisten en `_devInbox` con metadata para que los tests
 *   puedan verificar que la copia incluye los PDFs esperados.
 *
 * @param {object} opts
 * @param {string} opts.to - Correo destino
 * @param {string} opts.pdfPath - Path absoluto al PDF firmado en papel
 * @param {string} opts.constanciaPath - Path absoluto al Registro de firma autográfica
 * @param {object} opts.context - Metadata adicional
 *
 * @returns {Promise<{ok: boolean, messageId: string}>}
 * @throws Error si los archivos no existen o falla el envío
 */
async function sendCopiaFirmadoPapel({ to, pdfPath, constanciaPath, context }) {
  if (typeof to !== 'string' || !to.includes('@')) {
    throw new Error('sendCopiaFirmadoPapel: `to` debe ser un correo válido');
  }
  if (typeof pdfPath !== 'string' || !fs.existsSync(pdfPath)) {
    throw new Error(`sendCopiaFirmadoPapel: PDF firmado no existe: ${pdfPath}`);
  }
  if (typeof constanciaPath !== 'string' || !fs.existsSync(constanciaPath)) {
    throw new Error(`sendCopiaFirmadoPapel: Registro de firma no existe: ${constanciaPath}`);
  }

  // 9A (el 7.2): la firma en PAPEL tiene su propia constancia (el
  // "Registro de firma autográfica"), y el correo no puede decir
  // "Constancia de firma electrónica" cuando el documento se firmó a mano.
  const subject = 'K+AIR — Copia de tu documento firmado en papel';
  const id_solicitud = (context && context.id_solicitud) || 'desconocido';
  const id_constancia = (context && context.id_constancia) || 'desconocido';
  const body = [
    'Hola,',
    '',
    'Tu documento firmado en K+AIR está disponible.',
    '',
    `ID de solicitud: ${id_solicitud}`,
    `ID de constancia: ${id_constancia}`,
    '',
    'Adjuntamos el PDF del documento que firmaste en papel y el Registro de firma autográfica.',
    'Conserva ambos documentos como evidencia de la firma.',
    '',
    'Si no reconoces esta operación, contacta a RRHH de inmediato.',
    '',
    '— K+AIR',
  ].join('\n');

  if (config.env === 'production') {
    const transporter = getTransporter();
    const info = await transporter.sendMail({
      from: `"${config.smtp.fromName}" <${config.smtp.fromEmail}>`,
      to,
      subject,
      text: body,
      attachments: [
        { filename: 'documento-firmado.pdf', path: pdfPath },
        { filename: 'constancia.pdf', path: constanciaPath },
      ],
    });
    return { ok: true, messageId: info.messageId };
  }

  // Dev: jsonTransport no envía, pero guardamos los attachments en inbox
  const pdfStat = fs.statSync(pdfPath);
  const conStat = fs.statSync(constanciaPath);
  logger.info('[DEV-COPY] Copia firmada simulada', {
    to: to.replace(/(.{2}).*(@.*)/, '$1***$2'),
    id_solicitud,
    id_constancia,
    pdf_size: pdfStat.size,
    constancia_size: conStat.size,
    message_id_preview: `<${Math.random().toString(36).slice(2)}@dev>`,
  });
  const entry = {
    to, subject, body, tipo: 'copy_signed', context, sentAt: new Date().toISOString(),
    attachments: [
      { filename: 'documento-firmado.pdf', path: pdfPath, size: pdfStat.size },
      { filename: 'constancia.pdf', path: constanciaPath, size: conStat.size },
    ],
  };
  _devInbox.push(entry);
  if (_devInbox.length > 50) _devInbox.shift();

  return { ok: true, messageId: 'dev-copy-' + Date.now() };
}

/**
 * Envía el AVISO de que la firma electrónica quedó cerrada.
 *
 * Es un correo de AVISO, no un envío de documentos: NO lleva el PDF firmado
 * ni la Constancia adjuntos. La copia se entrega por el ENLACE de firma (el
 * 5.4 del Acuerdo de uso: "El Firmante puede imprimir o descargar copia de
 * este Acuerdo y del documento firmado desde el propio enlace de firma, sin
 * costo alguno") y el correo solo dice dónde está.
 *
 * Por qué el archivo no viaja: mandar el documento firmado y la Constancia
 * como adjuntos mete la evidencia de la firma en una caja de correo que no
 * es la del Responsable del tratamiento, y el aviso con enlace cumple el
 * mismo propósito sin ese problema. La firma en papel es la excepción, y
 * va por otra función (`sendCopiaFirmadoPapel`): ahí el Trabajador no tiene
 * enlace con el que bajar nada.
 *
 * Lo que SÍ viaja en el cuerpo: el ID de la solicitud (referencia legible
 * para el Trabajador y la Empresa; no es un dato de identidad ni del
 * documento) y la URL del enlace de firma. NO viaja: el número de
 * identificación del firmante, el nombre o el hash del documento, ni ningún
 * otro dato del documento. El ID de la Constancia tampoco: ya está impreso
 * dentro del propio PDF de la Constancia.
 *
 * En dev (jsonTransport): se guarda en `_devInbox` con tipo='copy_aviso' y
 * SIN clave `attachments`, para que los tests puedan comprobar que el
 * correo post-firma no lleva nada adjunto.
 *
 * @param {object} opts
 * @param {string} opts.to - Correo destino
 * @param {string} opts.url_publica - URL del enlace de firma
 *                                    (formato: `${publicUrl}/s/<token>`).
 * @param {string} opts.id_solicitud - ID legible de la solicitud
 *                                     (SIGN-YYYY-NNNNNN).
 * @param {object} [opts.context] - Metadata adicional (NO se loggea en plaintext).
 *
 * @returns {Promise<{ok: true, messageId: string}>}
 * @throws Error si `to` no parece correo, o si falla el envío.
 */
async function sendCopiaAviso({ to, url_publica, id_solicitud, context }) {
  if (typeof to !== 'string' || !to.includes('@')) {
    throw new Error('sendCopiaAviso: `to` debe ser un correo válido');
  }
  if (typeof url_publica !== 'string' || url_publica.length === 0) {
    throw new Error('sendCopiaAviso: `url_publica` requerida');
  }
  if (typeof id_solicitud !== 'string' || id_solicitud.length === 0) {
    throw new Error('sendCopiaAviso: `id_solicitud` requerido');
  }

  const subject = 'K+AIR — Ya puedes descargar tu documento firmado';
  const body = [
    'Hola,',
    '',
    'Tu documento quedó firmado electrónicamente en K+AIR.',
    '',
    `ID de solicitud: ${id_solicitud}`,
    '',
    'Para obtener tus copias, abre este enlace en tu navegador:',
    url_publica,
    '',
    'Desde el enlace puedes:',
    '- Descargar el documento firmado.',
    '- Ver la Constancia de la firma (el registro que certifica la firma).',
    '- Descargar la copia del Acuerdo de uso que aceptaste.',
    '',
    'Este correo no lleva el archivo adjunto: tus copias se descargan desde el',
    'enlace, para que el documento no quede en el correo.',
    '',
    'El enlace es el mismo que usaste para firmar y sirve mientras esté vigente.',
    'Si ya no responde, pídele a tu empresa una copia del documento firmado y',
    'de la Constancia.',
    '',
    'Si no reconoces esta operación, contacta a RRHH de inmediato.',
    '',
    '— K+AIR',
  ].join('\n');

  if (config.env === 'production') {
    const transporter = getTransporter();
    // SIN attachments: el aviso no lleva el documento firmado ni la
    // Constancia. La copia se baja del enlace.
    const info = await transporter.sendMail({
      from: `"${config.smtp.fromName}" <${config.smtp.fromEmail}">`,
      to,
      subject,
      text: body,
    });
    return { ok: true, messageId: info.messageId };
  }

  // Dev: jsonTransport no envía, pero guardamos el aviso en el inbox.
  logger.info('[DEV-COPY-AVISO] Aviso de firma enviada', {
    to: to.replace(/(.{2}).*(@.*)/, '$1***$2'),
    id_solicitud,
    message_id_preview: `<${Math.random().toString(36).slice(2)}@dev>`,
  });
  const entry = {
    to, subject, body, tipo: 'copy_aviso',
    id_solicitud, url_publica,
    context: context || null,
    sentAt: new Date().toISOString(),
  };
  _devInbox.push(entry);
  if (_devInbox.length > 50) _devInbox.shift();

  return { ok: true, messageId: 'dev-copy-aviso-' + Date.now() };
}

/**
 * Envía una invitación de firma al correo del firmante.
 *
 * A diferencia de sendOTP (que se usa durante la identification) y
 * sendCopiaAviso (post-commit, aviso con el enlace de descarga y SIN
 * adjuntos), sendInvite es
 * el "primer contacto" con el firmante: le notifica que tiene un documento
 * para firmar y le entrega la URL pública única de la mini-app.
 *
 * El firmante aún NO tiene OTP — el OTP se genera en publicFlow.identify()
 * cuando abre la URL y se identifica con su cédula. Esta función NO genera
 * ni envía OTP; solo la URL de invitación.
 *
 * subject: "K+AIR — Tienes un documento para firmar"
 * body: incluye id_solicitud, URL pública, instrucciones (abrir link,
 *       identificar con cédula, esperar OTP, firmar).
 * attachments: ninguno (es solo la invitación; el PDF no se envía por
 *              correo — el firmante lo VE en la mini-app y, una vez
 *              firmado, lo descarga desde el mismo enlace).
 *
 * En dev (jsonTransport): se guarda en _devInbox con tipo='invite' para
 * que los tests puedan verificar.
 *
 * @param {object} opts
 * @param {string} opts.to - Correo destino (validado por el handler; acá
 *                           solo sanity check).
 * @param {string} opts.url_publica - URL pública completa de la mini-app
 *                                    (formato: `${publicUrl}/s/<token>`).
 * @param {string} opts.id_solicitud - Identificador legible (SIGN-YYYY-NNNNNN)
 *                                     para que el firmante pueda referirse al doc.
 * @param {object} [opts.context] - Metadata adicional (NO se loggea en plaintext).
 * @param {string} [opts.plazo_retencion] - Plazo de conservación que declara
 *                                           la Empresa (numeral 8.6 del Acuerdo).
 * @param {string} [opts.canal_solicitud_copia] - Dónde puede el Trabajador
 *                                                  pedir una copia (numeral 8.6).
 * @param {string} [opts.canal_proteccion_datos] - El canal de PROTECCIÓN DE
 *   DATOS de K+AIR (el 10.7(b)): donde el Titular ejerce sus derechos. Es
 *   DISTINTO del canal de incidentes.
 * @param {object} [opts.deber_legal_conservacion] - { activo, norma }: si está
 *   activo, el documento NO se borra automáticamente porque hay un deber legal
 *   de conservación sin término (migración 029). El Trabajador tiene que
 *   saberlo: el 8.6 obliga a comunicar el plazo y sus consecuencias.
 *
 * @returns {Promise<{ok: true, messageId: string}>}
 * @throws Error si `to` no parece correo, o si falla el envío.
 */
async function sendInvite({
  to, url_publica, id_solicitud, context,
  plazo_retencion, canal_solicitud_copia, deber_legal_conservacion,
  canal_proteccion_datos,
}) {
  if (typeof to !== 'string' || !to.includes('@')) {
    throw new Error('sendInvite: `to` debe ser un correo válido');
  }
  if (typeof url_publica !== 'string' || url_publica.length === 0) {
    throw new Error('sendInvite: `url_publica` requerida');
  }
  if (typeof id_solicitud !== 'string' || id_solicitud.length === 0) {
    throw new Error('sendInvite: `id_solicitud` requerido');
  }

  const subject = 'K+AIR — Tienes un documento para firmar';
  const body = [
    'Hola,',
    '',
    'Tienes un documento de K+AIR esperándote para firma electrónica.',
    '',
    `ID de solicitud: ${id_solicitud}`,
    '',
    'Para firmarlo:',
    `1. Abre este enlace en tu navegador: ${url_publica}`,
    '2. Identifícate con tu tipo y número de documento de identidad.',
    '3. Recibirás un código (OTP) en este mismo correo.',
    '4. Ingrésalo en la página para ver el documento y firmar.',
    '',
    'El enlace expira según la configuración del documento (típicamente 24-72h).',
    //
    // El 7.2 del Acuerdo: el Trabajador tiene derecho a la firma
    // autográfica, sobre soporte papel, en todo momento y sin costo. Y el
    // 7.3: que no firme por esta vía no puede perjudicarle.
    //
    // La invitación es el PRIMER contacto: es el mejor lugar para que la
    // vía exista como opción y no como letra. No promete un plazo (la
    // Empresa no declara ninguno en el sistema) ni un resultado: solo dice
    // que la vía existe y que no tiene costo.
    '',
    'Si no querés firmar por esta vía, podés pedir la firma en papel:',
    'es tu derecho, no tiene costo y no te perjudica en nada. Lo pedís desde',
    'la misma página del enlace.',
    'Si no reconoces esta operación, contacta al área de RRHH de inmediato.',
    '',
    // Numeral 8.6 del Acuerdo de uso: "La Empresa debe comunicar al
    // Trabajador, antes de solicitarle la firma, el plazo que le resulta
    // aplicable al documento objeto de la firma y dónde puede ejercer, en
    // cualquier momento, una solicitud de copia."
    //
    // La invitación es ese momento: es la comunicación que sale ANTES de que
    // el Trabajador firme. El plazo y el canal los declara la Empresa (que
    // es el Responsable del tratamiento, numeral 10.1); K+AIR solo los
    // transporta. Si la Empresa no los ha declarado, el correo NO inventa un
    // plazo: simplemente no los incluye, y el bloque «Empresa que solicita
    // tu firma» de la mini-app los muestra como pendientes.
    ...(plazo_retencion
      ? ['', 'Plazo de conservación de tus datos: ' + plazo_retencion]
      : []),
    ...(canal_solicitud_copia
      ? ['Dónde puedes pedir una copia de tu documento: ' + canal_solicitud_copia]
      : []),
    // El deber legal sin término: el documento NO se borra automáticamente.
    // Es información que el Trabajador necesita (el 8.6 obliga a comunicar el
    // plazo y sus consecuencias).
    ...(deber_legal_conservacion && deber_legal_conservacion.activo
      ? ['',
        'Este documento no se borra automáticamente: la Empresa tiene un deber '
        + 'legal de conservación sin término'
        + (deber_legal_conservacion.norma
          ? ' (' + deber_legal_conservacion.norma + ')' : '') + '.']
      : []),
    ...(plazo_retencion || canal_solicitud_copia ? [''] : []),
    // El canal de derechos del Titular (10.7(b)): K+AIR lo recibe, lo registra
    // y lo trasmite a la Empresa, que es la que responde.
    ...(canal_proteccion_datos
      ? ['Derechos de tus datos: ' + canal_proteccion_datos + ' (K+AIR registra tu solicitud y la remite a tu empresa, que es quien debe responderte).']
      : []),
    '— K+AIR',
  ].join('\n');

  if (config.env === 'production') {
    const transporter = getTransporter();
    const info = await transporter.sendMail({
      from: `"${config.smtp.fromName}" <${config.smtp.fromEmail}>`,
      to,
      subject,
      text: body,
    });
    return {
      ok: true,
      messageId: info.messageId,
      // La huella del cuerpo enviado: es la prueba de QUÉ se le ofreció (el
      // 7.2-7.3). El evento `PAPER_OPTION_AVAILABLE` la guarda.
      body_hash: crypto.createHash('sha256').update(body).digest('hex'),
    };
  }

  // Dev: jsonTransport no envía, pero guardamos en inbox para tests.
  logger.info('[DEV-INVITE] Invitación simulada', {
    to: to.replace(/(.{2}).*(@.*)/, '$1***$2'),
    id_solicitud,
    message_id_preview: `<${Math.random().toString(36).slice(2)}@dev>`,
  });
  const entry = {
    to, subject, body, tipo: 'invite',
    id_solicitud, url_publica,
    context: context || null,
    sentAt: new Date().toISOString(),
  };
  _devInbox.push(entry);
  if (_devInbox.length > 50) _devInbox.shift();

  return {
    ok: true,
    messageId: 'dev-invite-' + Date.now(),
    body_hash: crypto.createHash('sha256').update(body).digest('hex'),
  };
}

/**
 * Envía invitación al representante legal de la empresa para firmar
 * como 2da firma (I-FIRMA-DUAL).
 *
 * El correo es DIFERENCIADO al del worker:
 * - Subject menciona "representante legal" / "firma dual"
 * - Body explica que el worker ya firmó y el rep es la 2da firma
 * - Body identifica al rep por nombre
 *
 * @param {object} opts
 * @param {string} opts.to - Correo del rep
 * @param {string} opts.url_publica - URL completa del link de firma
 * @param {string} opts.id_solicitud - ID del sign request
 * @param {string} opts.id_documento - ID del documento
 * @param {string} opts.rep_nombre - Nombre del representante legal
 * @param {object} opts.context - Metadata adicional
 *
 * @returns {Promise<{ok: boolean, messageId?: string}>}
 */
async function sendInviteForCompany({ to, url_publica, id_solicitud, id_documento, rep_nombre, context }) {
  if (typeof to !== 'string' || !to.includes('@')) {
    throw new Error('sendInviteForCompany: `to` debe ser un correo válido');
  }
  if (typeof url_publica !== 'string' || url_publica.length === 0) {
    throw new Error('sendInviteForCompany: `url_publica` requerida');
  }
  if (typeof id_solicitud !== 'string' || id_solicitud.length === 0) {
    throw new Error('sendInviteForCompany: `id_solicitud` requerido');
  }
  if (typeof id_documento !== 'string' || id_documento.length === 0) {
    throw new Error('sendInviteForCompany: `id_documento` requerido');
  }

  const subject = `K+AIR — Firma como representante legal — ${id_documento}`;
  const body = [
    `Hola ${rep_nombre || 'Representante Legal'},`,
    '',
    'Has sido designado como representante legal de la empresa para firmar',
    'un documento como SEGUNDA FIRMA (la primera ya fue firmada por el trabajador).',
    '',
    `ID de solicitud: ${id_solicitud}`,
    `ID de documento: ${id_documento}`,
    '',
    'Para firmar:',
    `1. Abre este enlace en tu navegador: ${url_publica}`,
    '2. Identifícate con tu tipo y número de documento de identidad (CC, CE, etc.).',
    '3. Recibirás un código (OTP) en este mismo correo.',
    '4. Ingrésalo en la página para ver el documento y firmar como representante legal.',
    '',
    'El enlace expira según la configuración del documento (típicamente 24-72h).',
    'Si no reconoces esta operación, contacta al área de RRHH de inmediato.',
    '',
    '— K+AIR Firma Dual',
  ].join('\n');

  if (config.env === 'production') {
    const transporter = getTransporter();
    const info = await transporter.sendMail({
      from: `"${config.smtp.fromName}" <${config.smtp.fromEmail}>`,
      to,
      subject,
      text: body,
    });
    return { ok: true, messageId: info.messageId };
  }

  // Dev: jsonTransport no envía, pero guardamos en inbox para tests.
  logger.info('[DEV-INVITE-COMPANY] Invitación al rep simulada', {
    to: to.replace(/(.{2}).*(@.*)/, '$1***$2'),
    id_solicitud,
    message_id_preview: `<${Math.random().toString(36).slice(2)}@dev>`,
  });
  const entry = {
    to, subject, body, tipo: 'invite-company',
    id_solicitud, id_documento, rep_nombre, url_publica,
    context: context || null,
    sentAt: new Date().toISOString(),
  };
  _devInbox.push(entry);
  if (_devInbox.length > 50) _devInbox.shift();

  return { ok: true, messageId: 'dev-invite-company-' + Date.now() };
}

/**
 * Envía un OTP al correo del trabajador.
 *
 * @param {object} opts
 * @param {string} opts.to - Correo destino
 * @param {string} opts.otp - OTP en texto plano (solo viaja, NO se guarda)
 * @param {string} opts.tipo - 'consent' | 'signature' | 'notification' | 'copy'
 * @param {object} opts.context - Metadata adicional para el correo
 *
 * @returns {Promise<{ok: boolean, messageId?: string, devOtp?: string}>}
 *   En dev, retorna devOtp para que los tests puedan capturarlo.
 */
async function sendOTP({ to, otp, tipo, context }) {
  if (typeof to !== 'string' || !to.includes('@')) {
    throw new Error('sendOTP: `to` debe ser un correo válido');
  }
  if (typeof otp !== 'string' || !/^\d{6}$/.test(otp)) {
    throw new Error('sendOTP: `otp` debe ser 6 dígitos');
  }

  const subject = makeSubject(tipo);
  const body = makeBody({ otp, tipo, context });

  if (config.env === 'production') {
    const transporter = getTransporter();
    const info = await transporter.sendMail({
      from: `"${config.smtp.fromName}" <${config.smtp.fromEmail}>`,
      to,
      subject,
      text: body,
    });
    return { ok: true, messageId: info.messageId };
  }

  // Dev: loguear y guardar en inbox
  logger.info('[DEV-OTP] Correo simulado', {
    to: to.replace(/(.{2}).*(@.*)/, '$1***$2'), // enmascarar
    tipo,
    otp_marker: '[REDACTED]',  // nunca loguear el OTP
    message_id_preview: `<${Math.random().toString(36).slice(2)}@dev>`,
  });
  const entry = { to, subject, body, otp, tipo, context, sentAt: new Date().toISOString() };
  _devInbox.push(entry);
  // Mantener solo los últimos 50
  if (_devInbox.length > 50) _devInbox.shift();

  return { ok: true, devOtp: otp, messageId: 'dev-' + Date.now() };
}

/**
 * Devuelve la cola de correos enviados en dev.
 * SOLO para tests. NUNCA usar en producción.
 */
function getDevInbox() {
  if (config.env === 'production') {
    throw new Error('getDevInbox no debe usarse en producción');
  }
  return _devInbox;
}

/**
 * Limpia la cola de dev (entre tests).
 */
function clearDevInbox() {
  _devInbox = [];
}

function makeSubject(tipo) {
  switch (tipo) {
    case 'consent':
      return 'K+AIR — Tu código para aceptar el Acuerdo de firma';
    case 'signature':
      return 'K+AIR — Tu código para firmar el documento';
    case 'invite':
      return 'K+AIR — Tienes un documento para firmar';
    case 'notification':
      return 'K+AIR — Tienes un documento para firmar';
    case 'copy':
      return 'K+AIR — Copia de tu documento firmado';
    default:
      return 'K+AIR — Notificación';
  }
}

function makeBody({ otp, tipo, context }) {
  const lines = [
    'Hola,',
    '',
  ];
  if (tipo === 'consent') {
    lines.push(
      'Has solicitado aceptar el Acuerdo de uso de firma electrónica de K+AIR.',
      '',
      `Tu código de verificación es: ${otp}`,
      '',
      'Este código expira en 10 minutos.',
      'Si no solicitaste este código, ignora este mensaje.',
    );
  } else if (tipo === 'signature') {
    lines.push(
      'Has solicitado firmar un documento en K+AIR.',
      '',
      `Tu código de verificación es: ${otp}`,
      '',
      'Este código expira en 10 minutos.',
      'Si no solicitaste firmar este documento, ignora este mensaje.',
    );
  } else {
    lines.push(
      `Notificación de K+AIR (tipo: ${tipo})`,
      '',
      context && context.message ? context.message : '',
    );
  }
  return lines.join('\n');
}

module.exports = {
  sendOTP,
  sendCopiaFirmadoPapel,  // 9A: la copia en PAPEL sí viaja por correo (adjunta).
  sendCopiaAviso,         // Firma electrónica: aviso con el enlace, SIN adjuntos.
  sendInvite,
  sendInviteForCompany,  // I-FIRMA-DUAL: invitación al rep legal (2da firma)
  getDevInbox,
  clearDevInbox,
};
