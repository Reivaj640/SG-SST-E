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
const { hashWithSalt, generateSalt, sha256 } = require('../crypto/hash');
const signRequestService = require('./signRequest');
const mailer = require('./mailer');
const storage = require('./storage');
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
};
