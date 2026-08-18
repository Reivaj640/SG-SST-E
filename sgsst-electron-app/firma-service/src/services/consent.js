/**
 * Servicio de Consentimiento del Acuerdo de uso.
 *
 * Maneja el ciclo de vida del consentimiento:
 * - create: crea un consentimiento PENDING, genera OTP, lo envía.
 * - verifyOtp: verifica el OTP y marca como aceptado.
 *
 * Ver DATA_MODEL.md §3.2 (tabla gh_consentimientos_firma).
 * Ver API.md §6.10 y §6.11.
 *
 * IMPORTANTE: este servicio NO firma documentos. Solo gestiona la
 * aceptación del Acuerdo de uso (mecanismo), que es independiente
 * de la firma de cada documento (contenido).
 */
'use strict';

const db = require('../db/connection');
const config = require('../config');
const { sha256, hashWithSalt, generateSalt } = require('../crypto/hash');
const { generateOTP, verifyOTP, isLocked, isExpired } = require('../crypto/otp');
const mailer = require('./mailer');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errors');

const ESTADO_PENDING = 'OTP_PENDING';
const ESTADO_ACCEPTED = 'ACCEPTED';
const ESTADO_LOCKED = 'OTP_LOCKED';

/**
 * Busca un consentimiento por su ID interno.
 */
function getById(id) {
  if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) return null;
  return db.prepare(`
    SELECT id, id_trabajador, id_empresa, version_acuerdo,
           hash_texto_acuerdo, correo_verificacion, correo_hash,
           otp_hash, otp_sal, otp_intentos, ip, user_agent,
           fecha_aceptacion, kair_version, manifestacion_aceptada,
           estado, created_at, updated_at
    FROM gh_consentimientos_firma
    WHERE id = ?
    LIMIT 1
  `).get(id);
}

/**
 * Busca un consentimiento existente para (trabajador, empresa, versión).
 */
function getExisting({ id_trabajador, id_empresa, version_acuerdo }) {
  return db.prepare(`
    SELECT id, id_trabajador, id_empresa, version_acuerdo,
           manifestacion_aceptada, estado, otp_intentos,
           fecha_aceptacion
    FROM gh_consentimientos_firma
    WHERE id_trabajador = ?
      AND id_empresa = ?
      AND version_acuerdo = ?
    LIMIT 1
  `).get(id_trabajador, id_empresa, version_acuerdo);
}

/**
 * Crea un consentimiento para que el trabajador acepte el Acuerdo.
 *
 * Flujo:
 * 1. Verifica que la versión del Acuerdo existe y está activa.
 * 2. Si ya existe un consentimiento ACEPTADO para esa versión,
 *    retorna { alreadyAccepted: true, consent }.
 * 3. Si ya existe un consentimiento PENDING/LOCKED, retorna
 *    { alreadyPending: true, consent } (no crea duplicado).
 * 4. Genera OTP, lo hashea con sal, guarda en BD.
 * 5. Envía OTP al correo.
 *
 * @param {object} opts
 * @param {string} opts.id_trabajador
 * @param {string} opts.id_empresa
 * @param {string} opts.version_acuerdo
 * @param {string} opts.correo_verificacion
 * @param {string} opts.kair_version
 * @param {string} [opts.ip]
 * @param {string} [opts.user_agent]
 * @returns {Promise<{consent: object, alreadyAccepted?: boolean,
 *                    alreadyPending?: boolean, devOtp?: string}>}
 */
async function create({
  id_trabajador, id_empresa, version_acuerdo,
  correo_verificacion, kair_version, ip, user_agent,
}) {
  // 1. Verificar acuerdo activo
  const acuerdo = db.prepare(`
    SELECT version, texto, texto_hash, activa
    FROM gh_firma_acuerdo_versiones
    WHERE version = ? AND activa = 1
    LIMIT 1
  `).get(version_acuerdo);

  if (!acuerdo) {
    throw new AppError(404, 'ACUERDO_NOT_FOUND',
      `No hay versión activa del Acuerdo con identificador '${version_acuerdo}'`);
  }

  // 2. Verificar si ya existe
  const existing = getExisting({ id_trabajador, id_empresa, version_acuerdo });
  if (existing) {
    if (existing.manifestacion_aceptada === 1) {
      return { alreadyAccepted: true, consent: existing };
    }
    if (existing.estado === ESTADO_PENDING) {
      return { alreadyPending: true, consent: existing };
    }
    // Si está LOCKED, podemos crear uno nuevo (después de un tiempo
    // de espera, o si RH lo resetea). Por ahora rechazamos.
    if (existing.estado === ESTADO_LOCKED) {
      throw new AppError(409, 'CONSENT_LOCKED',
        'Consentimiento bloqueado por exceso de intentos. Contacta a RRHH.');
    }
  }

  // 3. Generar OTP y hashes
  const otp = generateOTP();
  const otp_sal = generateSalt();
  const otp_hash = hashWithSalt(otp, otp_sal);
  const correo_sal = generateSalt();
  const correo_hash = hashWithSalt(correo_verificacion, correo_sal);
  const hash_texto_acuerdo = acuerdo.texto_hash; // ya calculado

  // 4. Insertar consentimiento
  const tx = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO gh_consentimientos_firma
        (id_trabajador, id_empresa, version_acuerdo,
         hash_texto_acuerdo, correo_verificacion, correo_hash,
         otp_hash, otp_sal, otp_intentos, ip, user_agent,
         kair_version, manifestacion_aceptada, estado)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 0, ?)
    `).run(
      id_trabajador, id_empresa, version_acuerdo,
      hash_texto_acuerdo, correo_verificacion, correo_hash,
      otp_hash, otp_sal, ip || null, user_agent || null,
      kair_version, ESTADO_PENDING,
    );
    return result.lastInsertRowid;
  });
  const consentId = tx();

  // 5. Enviar OTP (fuera de la transacción)
  const sendResult = await mailer.sendOTP({
    to: correo_verificacion,
    otp,
    tipo: 'consent',
    context: { consentId, version: version_acuerdo },
  });

  logger.info('Consentimiento creado, OTP enviado', {
    consent_id: consentId,
    id_trabajador,
    version_acuerdo,
  });

  const consent = getById(consentId);
  return { consent, devOtp: sendResult.devOtp };
}

/**
 * Verifica el OTP de un consentimiento y lo marca como aceptado.
 *
 * @param {object} opts
 * @param {number} opts.consentId
 * @param {string} opts.otp
 * @param {string} [opts.kair_version]
 * @returns {{ok: true, consent: object} |
 *           {ok: false, code: string, message: string, attempts: number}}
 */
function verifyOtp({ consentId, otp, kair_version }) {
  const consent = getById(consentId);
  if (!consent) {
    throw new AppError(404, 'CONSENT_NOT_FOUND',
      `Consentimiento ${consentId} no encontrado`);
  }

  // Si ya está aceptado, rechazar
  if (consent.manifestacion_aceptada === 1) {
    throw new AppError(409, 'ALREADY_ACCEPTED',
      'Este consentimiento ya fue aceptado');
  }

  // Si está bloqueado
  if (consent.estado === ESTADO_LOCKED) {
    throw new AppError(422, 'OTP_LOCKED',
      'Demasiados intentos. Contacta a RRHH.');
  }

  // Si está en estado distinto a PENDING
  if (consent.estado !== ESTADO_PENDING) {
    throw new AppError(409, 'INVALID_STATE',
      `Estado actual '${consent.estado}' no permite verificación`);
  }

  // Verificar OTP
  const result = verifyOTP(otp, consent.otp_hash, consent.otp_sal, consent.otp_intentos);

  if (result.valid) {
    // Aceptar
    const fecha_aceptacion = new Date().toISOString();
    const tx = db.transaction(() => {
      db.prepare(`
        UPDATE gh_consentimientos_firma
        SET manifestacion_aceptada = 1,
            fecha_aceptacion = ?,
            estado = ?,
            otp_intentos = ?,
            kair_version = COALESCE(?, kair_version),
            updated_at = datetime('now')
        WHERE id = ?
      `).run(fecha_aceptacion, ESTADO_ACCEPTED,
             result.attempts, kair_version, consentId);
    });
    tx();

    logger.info('Consentimiento aceptado', { consent_id: consentId });
    return { ok: true, consent: getById(consentId) };
  }

  // OTP incorrecto
  const newAttempts = result.attempts;
  const locked = isLocked(newAttempts, config.ttl.otpMaxAttempts);
  const estado = locked ? ESTADO_LOCKED : ESTADO_PENDING;
  const updateStmt = db.prepare(`
    UPDATE gh_consentimientos_firma
    SET otp_intentos = ?,
        estado = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `);
  updateStmt.run(newAttempts, estado, consentId);

  logger.warn('OTP incorrecto', {
    consent_id: consentId,
    attempts: newAttempts,
    locked,
  });

  if (locked) {
    throw new AppError(422, 'OTP_LOCKED',
      `Demasiados intentos (${newAttempts}). Consentimiento bloqueado.`,
      { attempts: newAttempts });
  }

  throw new AppError(422, 'OTP_INVALID',
    'El código ingresado no es correcto',
    { attempts: newAttempts, max_attempts: config.ttl.otpMaxAttempts });
}

module.exports = {
  create,
  verifyOtp,
  getById,
  getExisting,
  ESTADO_PENDING,
  ESTADO_ACCEPTED,
  ESTADO_LOCKED,
};
