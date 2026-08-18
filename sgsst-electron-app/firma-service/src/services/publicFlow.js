/**
 * Servicio de Flujo Público de firma.
 *
 * Maneja todas las operaciones que el trabajador hace desde la
 * mini-app pública. Usa el token como bearer implícito (sin header
 * de auth — el token ES la credencial).
 *
 * Sub-bloque 1: resolveToken + identify
 * Sub-bloque 2: verifyOtp
 * Sub-bloque 3: viewDocument + getPdf
 * Sub-bloque 4: commit + reject
 *
 * Ver DATA_MODEL.md §3.3, §3.5 y API.md §5.
 * Ver FLOWS.md §3 (Flujo 2: Firma presencial).
 */
'use strict';

const crypto = require('crypto');
const db = require('../db/connection');
const config = require('../config');
const { hashToken } = require('../crypto/token');
const { generateOTP, hashOTP, verifyOTP, isLocked } = require('../crypto/otp');
const { hashWithSalt, generateSalt, sha256, generateIdSolicitud: _ } = require('../crypto/hash');
const { canonicalJSON } = require('../crypto/compare');
const signRequestService = require('./signRequest');
const mailer = require('./mailer');
const storage = require('./storage');
const pdfGen = require('./pdfGen');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errors');

/**
 * Resultado de resolver un token.
 *
 * - ok=true: el token es válido, se retorna el contexto
 * - ok=false: hubo un error (revisar code y message)
 */
function resolveTokenResult(ok, code, message, signRequest, estado) {
  return { ok, code, message, signRequest, estado };
}

/**
 * Resuelve un token y retorna el contexto público.
 *
 * Valida:
 * - El token existe (calculando token_hash y buscando en BD)
 * - La solicitud no ha expirado
 * - El estado es adecuado (no terminal)
 *
 * Retorna un objeto con:
 *   { signRequest, estado } si todo OK
 *
 * Lanza AppError si hay algún problema (404 / 410 / 409).
 */
function resolveToken(token) {
  if (typeof token !== 'string' || token.length === 0) {
    throw new AppError(404, 'TOKEN_NOT_FOUND', 'Token no encontrado');
  }

  const token_hash = hashToken(token);
  const signRequest = signRequestService.getByTokenHash(token_hash);

  if (!signRequest) {
    throw new AppError(404, 'TOKEN_NOT_FOUND', 'El token no existe');
  }

  // Verificar expiración
  const now = Date.now();
  const expiresAt = new Date(signRequest.fecha_expiracion).getTime();
  if (now > expiresAt) {
    // Marcar como expirado si aún no lo está (idempotente)
    if (!['EXPIRED', 'SIGNED', 'REJECTED', 'REVOKED', 'CANCELLED'].includes(signRequest.estado)) {
      const tx = db.transaction(() => {
        db.prepare(`
          UPDATE gh_firmas_electronicas
          SET estado = 'EXPIRED'
          WHERE id = ? AND estado NOT IN ('SIGNED', 'REJECTED', 'REVOKED', 'CANCELLED', 'EXPIRED')
        `).run(signRequest.id);
        signRequestService.registerEvent(signRequest.id, 'EXPIRED', null, 'sistema');
      });
      tx();
    }
    throw new AppError(410, 'TOKEN_EXPIRED', 'El token ha expirado', {
      expired_at: signRequest.fecha_expiracion,
    });
  }

  // Estados terminales
  if (['SIGNED', 'REJECTED', 'REVOKED', 'CANCELLED', 'EXPIRED'].includes(signRequest.estado)) {
    throw new AppError(410, 'TOKEN_ALREADY_USED',
      `La solicitud está en estado terminal '${signRequest.estado}'`);
  }

  return { signRequest, estado: signRequest.estado };
}

/**
 * Registra el evento OPENED si es la primera vez que se carga el token.
 *
 * No transiciona de estado a menos que sea el primer OPENED.
 */
function registerOpenedIfFirst(signRequest, ip, user_agent) {
  if (signRequest.fecha_apertura) {
    return; // ya estaba abierto
  }
  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE gh_firmas_electronicas
      SET fecha_apertura = ?
      WHERE id = ?
    `).run(new Date().toISOString(), signRequest.id);
    signRequestService.registerEvent(signRequest.id, 'OPENED',
      { token_prefix: signRequest.id_solicitud }, 'trabajador', ip, user_agent);
  });
  tx();
}

/**
 * Transiciona el estado a IDENTIFICATION_STARTED.
 */
function transitionToIdentificationStarted(signRequest, ip, user_agent) {
  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE gh_firmas_electronicas
      SET estado = 'IDENTIFICATION_STARTED',
          ip_origen = COALESCE(?, ip_origen),
          user_agent = COALESCE(?, user_agent)
      WHERE id = ? AND estado IN ('PENDING', 'OPENED', 'IDENTIFICATION_STARTED')
    `).run(ip || null, user_agent || null, signRequest.id);
    signRequestService.registerEvent(signRequest.id, 'IDENTIFICATION_STARTED',
      null, 'trabajador', ip, user_agent);
  });
  tx();
}

/**
 * Identifica al trabajador. Valida cédula contra el hash guardado.
 *
 * Si la identificación es exitosa, genera OTP, lo guarda hasheado,
 * y envía por correo.
 *
 * @param {string} token
 * @param {string} tipo_documento
 * @param {string} numero_documento
 * @param {string} ip
 * @param {string} user_agent
 * @returns {Promise<{ok: true, estado, otp_ttl_seconds, correo_destino_enmascarado, devOtp?}>}
 */
async function identify(token, tipo_documento, numero_documento, ip, user_agent) {
  // 1. Resolver token
  const { signRequest } = resolveToken(token);

  // 2. Validar que la solicitud está en estado adecuado para identify
  const estadosPermitidos = ['PENDING', 'OPENED', 'IDENTIFICATION_STARTED', 'IDENTIFIED', 'OTP_SENT', 'OTP_VERIFIED', 'DOCUMENT_OPENED', 'DOCUMENT_VIEWED'];
  if (!estadosPermitidos.includes(signRequest.estado)) {
    throw new AppError(409, 'INVALID_STATE_TRANSITION',
      `No se puede identificar en estado '${signRequest.estado}'`,
      { current_state: signRequest.estado });
  }

  // 3. Validar que tenemos los datos de identificación guardados
  if (!signRequest.identificacion_numero_hash || !signRequest.identificacion_tipo) {
    throw new AppError(500, 'MISSING_IDENTIFICATION_DATA',
      'La solicitud no tiene datos de identificación del trabajador');
  }

  // 4. Validar tipo de documento
  if (signRequest.identificacion_tipo !== tipo_documento) {
    throw new AppError(422, 'IDENTIFICATION_FAILED',
      'El tipo de documento no coincide',
      { expected: signRequest.identificacion_tipo, provided: tipo_documento });
  }

  // 5. Calcular hash SHA-256 de la cédula ingresada y comparar.
  //    K+AIR debe hashear con el mismo método (SHA-256 sin sal).
  const provided_hash = sha256(numero_documento);
  if (provided_hash !== signRequest.identificacion_numero_hash) {
    // Incrementar intentos
    db.prepare(`
      UPDATE gh_firmas_electronicas
      SET identificacion_coincidio = 0
      WHERE id = ?
    `).run(signRequest.id);
    signRequestService.registerEvent(signRequest.id, 'IDENTIFICATION_FAILED',
      { tipo_documento }, 'trabajador', ip, user_agent);

    throw new AppError(422, 'IDENTIFICATION_FAILED',
      'La identificación no coincide con nuestros registros');
  }

  // 6. Identificación exitosa
  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE gh_firmas_electronicas
      SET estado = 'IDENTIFIED',
          identificacion_coincidio = 1,
          fecha_otp_enviado = ?
      WHERE id = ?
    `).run(new Date().toISOString(), signRequest.id);
    signRequestService.registerEvent(signRequest.id, 'IDENTIFICATION_COMPLETED',
      { tipo_documento }, 'trabajador', ip, user_agent);
  });
  tx();

  // 7. Generar OTP
  const otp = generateOTP();
  const otp_sal = generateSalt();
  const otp_hash = hashWithSalt(otp, otp_sal);

  // 8. Guardar OTP
  const tx2 = db.transaction(() => {
    db.prepare(`
      UPDATE gh_firmas_electronicas
      SET estado = 'OTP_SENT',
          otp_hash = ?,
          otp_sal = ?,
          otp_intentos = 0,
          otp_bloqueado = 0,
          fecha_otp_enviado = ?
      WHERE id = ?
    `).run(otp_hash, otp_sal, new Date().toISOString(), signRequest.id);
    signRequestService.registerEvent(signRequest.id, 'OTP_SENT',
      { canal: 'email' }, 'sistema', ip, user_agent);
  });
  tx2();

  // 9. Obtener correo (lo guardamos en la solicitud o en consentimiento)
  // Por ahora, usamos un placeholder. K+AIR lo enviará en el flujo.
  // TODO: integrar con la BD de trabajadores cuando exista.
  // Por ahora, lo dejamos en metadata si está disponible.
  const correo = (signRequest.metadata && JSON.parse(signRequest.metadata || '{}').correo) || 'trabajador@ejemplo.com';

  // 10. Enviar OTP
  const sendResult = await mailer.sendOTP({
    to: correo,
    otp,
    tipo: 'signature',
    context: { id_solicitud: signRequest.id_solicitud },
  });

  logger.info('Identificación exitosa, OTP enviado', {
    id_solicitud: signRequest.id_solicitud,
    tipo_documento,
  });

  // 11. Respuesta pública
  return {
    estado: 'OTP_SENT',
    otp_ttl_seconds: config.ttl.otpSeconds,
    correo_destino_enmascarado: maskEmail(correo),
    devOtp: sendResult.devOtp,  // solo en dev
  };
}

function maskEmail(email) {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  const visible = local.slice(0, Math.min(4, local.length));
  return `${visible}${'*'.repeat(Math.max(0, local.length - visible.length))}@${domain}`;
}

/**
 * Cierra la firma: transición atómica a SIGNED.
 *
 * Precondiciones:
 * - Token válido
 * - Estado = DOCUMENT_VIEWED
 * - manifestacion_aceptada = true
 *
 * Pasos (en transacción):
 * 1. Verificar precondiciones
 * 2. Calcular document_hash_firmado (SHA-256 del PDF con metadata)
 * 3. Construir JSON de evidencia
 * 4. Calcular evidence_hash (SHA-256 del JSON canónico)
 * 5. UPDATE estado=SIGNED con todos los hashes
 * 6. Generar PDF firmado (con metadata)
 * 7. Generar Constancia PDF
 * 8. Guardar ambos en storage
 * 9. Insertar eventos (MANIFESTATION_RECORDED, SIGN_COMMITTED, PDF_GENERATED, COPY_SENT)
 * 10. Enviar correo con PDF + Constancia
 *
 * @param {string} token
 * @param {object} opts - { manifestacion_aceptada, firma_visual_png? }
 * @returns {Promise<{ok: true, estado, evidence_hash, fecha_firma, ...}>}
 */
async function commit(token, opts, ip, user_agent) {
  // 1. Resolver token
  const { signRequest } = resolveToken(token);

  // 2. Validar precondiciones
  if (signRequest.estado !== 'DOCUMENT_VIEWED') {
    throw new AppError(409, 'INVALID_STATE_TRANSITION',
      `No se puede firmar en estado '${signRequest.estado}'`,
      { current_state: signRequest.estado });
  }
  if (!opts.manifestacion_aceptada) {
    throw new AppError(400, 'INVALID_REQUEST_BODY',
      'Debe aceptar la manifestación de voluntad (manifestacion_aceptada=true)');
  }

  // 3. Leer PDF original
  const pdfOriginal = storage.readPdf(signRequest.pdf_original_path);

  // 4. Generar PDF firmado (con metadata XMP)
  const fecha_firma = new Date().toISOString();
  const pdfFirmadoBuf = await pdfGen.generateSignedPdf(pdfOriginal, {
    id_solicitud: signRequest.id_solicitud,
    id_documento: signRequest.id_documento,
    id_trabajador: signRequest.id_trabajador,
    fecha_firma,
  });
  const document_hash_firmado = sha256(pdfFirmadoBuf);

  // 5. Construir evidencia (JSON canónico)
  const evidencia = {
    id_solicitud: signRequest.id_solicitud,
    id_documento: signRequest.id_documento,
    id_trabajador: signRequest.id_trabajador,
    id_empresa: signRequest.id_empresa,
    document_hash_original: signRequest.document_hash_original,
    document_hash_firmado,
    agreement_hash: signRequest.agreement_hash,
    identificacion_tipo: signRequest.identificacion_tipo,
    fecha_creacion: signRequest.fecha_creacion,
    fecha_firma,
    version_kair: signRequest.version_kair,
    manifestacion_voluntad_texto: 'He leído, comprendido y acepto el contenido del documento en su totalidad.',
  };
  const evidencia_canonica = canonicalJSON(evidencia);
  const evidence_hash = sha256(evidencia_canonica);

  // 6. UPDATE atómico
  const updateResult = db.prepare(`
    UPDATE gh_firmas_electronicas
    SET estado = 'SIGNED',
        document_hash_firmado = ?,
        evidence_hash = ?,
        fecha_manifestacion = ?,
        fecha_firma = ?,
        manifestacion_voluntad_texto = ?
    WHERE id = ? AND estado = 'DOCUMENT_VIEWED'
  `).run(
    document_hash_firmado, evidence_hash, fecha_firma, fecha_firma,
    evidencia.manifestacion_voluntad_texto, signRequest.id,
  );

  if (updateResult.changes !== 1) {
    // Race condition: otro commit ganó
    throw new AppError(409, 'INVALID_STATE_TRANSITION',
      'La firma no se pudo cerrar: el estado cambió durante el commit');
  }

  // 7. Guardar PDF firmado y Constancia
  const pdf_firmado_path = storage.PATHS.firmados + '/' + signRequest.id_solicitud + '.pdf';
  const constancia_filename = signRequest.id_solicitud + '-constancia.pdf';
  const constancia_path = storage.PATHS.constancias + '/' + constancia_filename;

  require('fs').writeFileSync(pdf_firmado_path, pdfFirmadoBuf);

  // Generar y guardar constancia
  const id_constancia = `GEN-${fecha_firma.replace(/[:.]/g, '-')}`;
  const constanciaBuf = await pdfGen.generateConstanciaPdf({
    ...evidencia,
    id_constancia,
  });
  require('fs').writeFileSync(constancia_path, constanciaBuf);

  // 8. UPDATE con paths
  db.prepare(`
    UPDATE gh_firmas_electronicas
    SET pdf_firmado_path = ?,
        constancia_path = ?
    WHERE id = ?
  `).run(pdf_firmado_path, constancia_path, signRequest.id);

  // 9. Eventos
  const tx = db.transaction(() => {
    signRequestService.registerEvent(signRequest.id, 'MANIFESTATION_RECORDED',
      { texto_hash: sha256(evidencia.manifestacion_voluntad_texto) },
      'trabajador', ip, user_agent);
    signRequestService.registerEvent(signRequest.id, 'SIGN_COMMITTED',
      { evidence_hash }, 'trabajador', ip, user_agent);
    signRequestService.registerEvent(signRequest.id, 'PDF_GENERATED',
      { path: pdf_firmado_path, size: pdfFirmadoBuf.length },
      'sistema', ip, user_agent);
    signRequestService.registerEvent(signRequest.id, 'COPY_SENT',
      { canal: 'email' }, 'sistema', ip, user_agent);
  });
  tx();

  // 10. Enviar correo con PDF + Constancia
  const correo = (signRequest.metadata && JSON.parse(signRequest.metadata || '{}').correo) || 'trabajador@ejemplo.com';
  try {
    await mailer.sendOTP({
      to: correo,
      otp: '000000',  // dummy, no se usa
      tipo: 'copy',
      context: {
        id_solicitud: signRequest.id_solicitud,
        message: `Tu documento firmado está disponible. PDF: ${pdf_firmado_path}, Constancia: ${constancia_path}`,
      },
    });
  } catch (err) {
    logger.warn('No se pudo enviar copia al trabajador', { error: err.message });
  }

  logger.info('Firma cerrada', {
    id_solicitud: signRequest.id_solicitud,
    evidence_hash,
  });

  return {
    ok: true,
    estado: 'SIGNED',
    id_solicitud: signRequest.id_solicitud,
    document_hash_firmado,
    evidence_hash,
    fecha_firma,
    id_constancia,
    pdf_firmado_url: `/internal/sign-requests/${signRequest.id_solicitud}/pdf-firmado`,
    constancia_url: `/internal/sign-requests/${signRequest.id_solicitud}/constancia`,
  };
}

/**
 * Registra rechazo explícito del documento.
 *
 * @param {string} token
 * @param {string} [motivo] - Motivo del rechazo (opcional)
 * @returns {{ok: true, estado: 'REJECTED'}}
 */
function reject(token, motivo, ip, user_agent) {
  // 1. Lookup directo (sin resolveToken que retornaría 410 si SIGNED)
  if (typeof token !== 'string' || token.length === 0) {
    throw new AppError(404, 'TOKEN_NOT_FOUND', 'Token no encontrado');
  }
  const token_hash = hashToken(token);
  const signRequest = signRequestService.getByTokenHash(token_hash);
  if (!signRequest) {
    throw new AppError(404, 'TOKEN_NOT_FOUND', 'El token no existe');
  }

  // 2. Validar estado: no se puede rechazar si ya está firmado
  if (signRequest.estado === 'SIGNED') {
    throw new AppError(409, 'INVALID_STATE_TRANSITION',
      'No se puede rechazar un documento ya firmado');
  }

  // 3. Validar estados terminales
  if (['REJECTED', 'CANCELLED', 'REVOKED'].includes(signRequest.estado)) {
    throw new AppError(409, 'INVALID_STATE_TRANSITION',
      `La solicitud ya está en estado '${signRequest.estado}'`);
  }

  // 4. Validar expiración
  const now = Date.now();
  const expiresAt = new Date(signRequest.fecha_expiracion).getTime();
  if (now > expiresAt) {
    throw new AppError(410, 'TOKEN_EXPIRED', 'El token ha expirado');
  }

  // 3. UPDATE atómico
  const updateResult = db.prepare(`
    UPDATE gh_firmas_electronicas
    SET estado = 'REJECTED',
        motivo_rechazo = ?
    WHERE id = ? AND estado NOT IN ('SIGNED', 'REJECTED', 'CANCELLED', 'REVOKED')
  `).run(motivo || null, signRequest.id);

  if (updateResult.changes !== 1) {
    throw new AppError(409, 'INVALID_STATE_TRANSITION',
      'La firma no se pudo rechazar: el estado cambió');
  }

  // 4. Evento
  signRequestService.registerEvent(signRequest.id, 'REJECTED',
    { motivo_texto: motivo || null }, 'trabajador', ip, user_agent);

  logger.info('Documento rechazado', {
    id_solicitud: signRequest.id_solicitud,
    motivo: motivo || '(sin motivo)',
  });

  return {
    ok: true,
    estado: 'REJECTED',
    id_solicitud: signRequest.id_solicitud,
  };
}

/**
 * Registra que el trabajador vio el documento (scroll al final).
 *
 * Transición: OTP_VERIFIED -> DOCUMENT_OPENED -> DOCUMENT_VIEWED
 *
 * @param {string} token
 * @param {object} opts - { segundosEnPagina, scrollAlFinal }
 * @returns {{ok: true, estado, manifestacion_voluntad_texto}}
 */
function viewDocument(token, { segundosEnPagina, scrollAlFinal }, ip, user_agent) {
  // 1. Resolver token
  const { signRequest } = resolveToken(token);

  // 2. Validar estado: debe estar al menos en OTP_VERIFIED
  const estadosPermitidos = ['OTP_VERIFIED', 'DOCUMENT_OPENED', 'DOCUMENT_VIEWED', 'MANIFESTATION_RECORDED'];
  if (!estadosPermitidos.includes(signRequest.estado)) {
    throw new AppError(409, 'INVALID_STATE_TRANSITION',
      `No se puede ver el documento en estado '${signRequest.estado}'`,
      { current_state: signRequest.estado });
  }

  // 3. Validar que vio el documento hasta el final
  if (!scrollAlFinal) {
    throw new AppError(422, 'INVALID_REQUEST_BODY',
      'Debe scrollear al final del documento antes de continuar');
  }

  // 4. Transición de estado
  const now = new Date().toISOString();
  const nuevoEstado = signRequest.estado === 'OTP_VERIFIED'
    ? 'DOCUMENT_VIEWED'  // primera vez: salta a VIEWED si trae scroll=true
    : 'DOCUMENT_VIEWED';
  // NOTA: en el flujo real, DOCUMENT_OPENED y DOCUMENT_VIEWED son separados
  // (uno cuando abre el visor, otro cuando scrollea al final).
  // Para v1 simplificamos: viewDocument con scroll=true marca VIEWED.

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE gh_firmas_electronicas
      SET estado = ?,
          fecha_documento_visto = COALESCE(fecha_documento_visto, ?)
      WHERE id = ?
    `).run(nuevoEstado, now, signRequest.id);
    signRequestService.registerEvent(signRequest.id, 'DOCUMENT_VIEWED',
      { segundos_en_pagina: segundosEnPagina || 0 }, 'trabajador', ip, user_agent);
  });
  tx();

  logger.info('Documento visto', { id_solicitud: signRequest.id_solicitud });

  return {
    ok: true,
    estado: nuevoEstado,
  };
}

/**
 * Devuelve el PDF del documento para descarga/visualización.
 *
 * Solo accesible en estados donde se ha verificado OTP.
 */
function getPdfForToken(token) {
  // 1. Resolver token
  const { signRequest } = resolveToken(token);

  // 2. Validar estado
  const estadosPermitidos = ['OTP_VERIFIED', 'DOCUMENT_OPENED', 'DOCUMENT_VIEWED', 'MANIFESTATION_RECORDED', 'SIGNED'];
  if (!estadosPermitidos.includes(signRequest.estado)) {
    throw new AppError(409, 'INVALID_STATE_TRANSITION',
      `El PDF no está disponible en estado '${signRequest.estado}'`,
      { current_state: signRequest.estado });
  }

  // 3. Leer PDF
  if (!signRequest.pdf_original_path) {
    throw new AppError(500, 'PDF_NOT_FOUND', 'No se encontró el PDF original');
  }

  const pdfBuffer = storage.readPdf(signRequest.pdf_original_path);
  return {
    buffer: pdfBuffer,
    filename: `${signRequest.id_solicitud}.pdf`,
  };
}

/**
 * Verifica el OTP de una solicitud.
 *
 * @param {string} token
 * @param {string} otp - 6 dígitos
 * @param {string} ip
 * @param {string} user_agent
 * @returns {{ok: true, estado: 'OTP_VERIFIED'} |
 *           {ok: false, code, message, attempts?}}
 */
function verifyOtp(token, otp, ip, user_agent) {
  // 1. Resolver token
  const { signRequest } = resolveToken(token);

  // 2. Verificar bloqueo (antes del estado, porque OTP_LOCKED es terminal)
  if (signRequest.estado === 'OTP_LOCKED' || signRequest.otp_bloqueado) {
    throw new AppError(422, 'OTP_LOCKED',
      'Demasiados intentos. El OTP está bloqueado.',
      { attempts: signRequest.otp_intentos, max_attempts: config.ttl.otpMaxAttempts });
  }

  // 3. Validar estado actual
  if (signRequest.estado !== 'OTP_SENT' && signRequest.estado !== 'OTP_VERIFIED') {
    throw new AppError(409, 'INVALID_STATE_TRANSITION',
      `No se puede verificar OTP en estado '${signRequest.estado}'`,
      { current_state: signRequest.estado });
  }

  // 4. Verificar OTP
  if (!signRequest.otp_hash || !signRequest.otp_sal) {
    throw new AppError(500, 'MISSING_OTP_DATA', 'No hay OTP almacenado para esta solicitud');
  }

  const result = verifyOTP(otp, signRequest.otp_hash, signRequest.otp_sal, signRequest.otp_intentos);

  if (result.valid) {
    // 5. OTP correcto
    const tx = db.transaction(() => {
      db.prepare(`
        UPDATE gh_firmas_electronicas
        SET estado = 'OTP_VERIFIED',
            otp_intentos = ?,
            fecha_otp_verificado = ?
        WHERE id = ?
      `).run(result.attempts, new Date().toISOString(), signRequest.id);
      signRequestService.registerEvent(signRequest.id, 'OTP_VERIFIED',
        { intentos: result.attempts }, 'trabajador', ip, user_agent);
    });
    tx();

    logger.info('OTP verificado', { id_solicitud: signRequest.id_solicitud });
    return { ok: true, estado: 'OTP_VERIFIED' };
  }

  // 6. OTP incorrecto
  const locked = isLocked(result.attempts, config.ttl.otpMaxAttempts);
  const newEstado = locked ? 'OTP_LOCKED' : 'OTP_SENT';
  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE gh_firmas_electronicas
      SET otp_intentos = ?,
          estado = ?,
          otp_bloqueado = ?
      WHERE id = ?
    `).run(result.attempts, newEstado, locked ? 1 : 0, signRequest.id);
    signRequestService.registerEvent(signRequest.id, locked ? 'OTP_LOCKED' : 'OTP_FAILED',
      { intentos: result.attempts, locked }, 'trabajador', ip, user_agent);
  });
  tx();

  if (locked) {
    throw new AppError(422, 'OTP_LOCKED',
      `Demasiados intentos (${result.attempts}). OTP bloqueado.`,
      { attempts: result.attempts, max_attempts: config.ttl.otpMaxAttempts });
  }

  throw new AppError(422, 'OTP_INVALID',
    'El código ingresado no es correcto',
    { attempts: result.attempts, max_attempts: config.ttl.otpMaxAttempts });
}

module.exports = {
  resolveToken,
  registerOpenedIfFirst,
  transitionToIdentificationStarted,
  identify,
  verifyOtp,
  viewDocument,
  getPdfForToken,
  commit,
  reject,
};
