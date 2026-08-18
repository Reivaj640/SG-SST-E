/**
 * Servicio de Sign Request (solicitud de firma).
 *
 * Maneja:
 * - create: crea una solicitud con PDF congelado, token_hash, ID.
 * - getById: consulta por id.
 * - getByIdSolicitud: consulta por id_solicitud (SIGN-YYYY-NNNNNN).
 * - getByTokenHash: consulta por token_hash (validación al recibir token).
 * - list: lista con filtros.
 * - registerEvent: registra un evento (helper para otros services).
 *
 * Ver DATA_MODEL.md §3.3 (tabla gh_firmas_electronicas) y
 * DATA_MODEL.md §3.5 (tabla gh_firma_sesiones).
 * Ver API.md §6.1, §6.2, §6.8.
 *
 * IMPORTANTE: este service NO firma documentos. Solo crea y
 * gestiona el ciclo de vida de la solicitud.
 */
'use strict';

const db = require('../db/connection');
const config = require('../config');
const { sha256 } = require('../crypto/hash');
const { generateToken, hashToken, generateIdSolicitud } = require('../crypto/token');
const storage = require('./storage');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errors');

const MAX_PDF_SIZE = 10 * 1024 * 1024; // 10 MB
const PDF_MAGIC = Buffer.from('%PDF-');

/**
 * Crea una nueva solicitud de firma.
 *
 * @param {object} opts
 * @param {string} opts.id_documento
 * @param {string} opts.id_trabajador
 * @param {string} opts.id_empresa
 * @param {string} opts.tipo_firma - 'presencial' | 'remoto'
 * @param {string} opts.agreement_hash - SHA-256 del Acuerdo
 * @param {string} opts.document_hash - SHA-256 declarado por K+AIR
 * @param {Buffer} opts.pdf_buffer - Bytes del PDF
 * @param {string} opts.pdf_filename - Nombre del archivo (opcional)
 * @param {string} opts.version_kair
 * @param {string} [opts.ip]
 * @param {string} [opts.user_agent]
 * @param {string} [opts.metadata] - JSON string
 * @returns {{signRequest: object, token: string, url_publica: string}}
 */
function create({
  id_documento, id_trabajador, id_empresa, tipo_firma,
  agreement_hash, document_hash, pdf_buffer, pdf_filename,
  version_kair, ip, user_agent, metadata,
}) {
  // Validar PDF
  if (!Buffer.isBuffer(pdf_buffer)) {
    throw new AppError(400, 'INVALID_REQUEST_BODY', 'pdf_buffer debe ser un Buffer');
  }
  if (pdf_buffer.length === 0) {
    throw new AppError(400, 'INVALID_REQUEST_BODY', 'PDF vacío');
  }
  if (pdf_buffer.length > MAX_PDF_SIZE) {
    throw new AppError(413, 'INVALID_REQUEST_BODY',
      `PDF demasiado grande (${pdf_buffer.length} bytes, máximo ${MAX_PDF_SIZE})`);
  }
  // Verificar magic bytes (los PDFs empiezan con %PDF-)
  if (!pdf_buffer.slice(0, 5).equals(PDF_MAGIC)) {
    throw new AppError(400, 'INVALID_REQUEST_BODY',
      'El archivo no parece ser un PDF válido (faltan magic bytes %PDF-)');
  }

  // Validar que el hash declarado coincida con el calculado
  const calculated_hash = sha256(pdf_buffer);
  if (document_hash && document_hash !== calculated_hash) {
    throw new AppError(422, 'DOCUMENT_HASH_MISMATCH',
      'El hash del PDF no coincide con el declarado',
      { declared: document_hash, calculated: calculated_hash });
  }

  // Generar token y IDs
  const token = generateToken();
  const token_hash = hashToken(token);
  const id_solicitud = generateIdSolicitud();
  const sesion_id = require('crypto').randomUUID();

  // TTL
  const ttl_horas = tipo_firma === 'presencial'
    ? config.ttl.tokenHoursPresencial
    : config.ttl.tokenHoursRemote;
  const now = new Date();
  const fecha_expiracion = new Date(now.getTime() + ttl_horas * 3600 * 1000).toISOString();

  // Guardar PDF
  const safe_filename = `${id_solicitud}.pdf`;
  const pdf_original_path = storage.saveOriginal(safe_filename, pdf_buffer);

  // Insertar en BD + sesión en transacción
  const tx = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO gh_firmas_electronicas
        (id_solicitud, id_documento, id_trabajador, id_empresa,
         tipo_firma, estado, document_hash_original, agreement_hash,
         token_hash, sesion_id, fecha_creacion, fecha_expiracion, version_kair,
         ip_origen, user_agent, pdf_original_path, metadata,
         verification_channel)
      VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'email')
    `).run(
      id_solicitud, id_documento, id_trabajador, id_empresa,
      tipo_firma, calculated_hash, agreement_hash,
      token_hash, sesion_id, now.toISOString(), fecha_expiracion, version_kair,
      ip || null, user_agent || null, pdf_original_path, metadata || null,
    );
    const firmaId = result.lastInsertRowid;

    // Crear sesión
    db.prepare(`
      INSERT INTO gh_firma_sesiones
        (id, firma_id, estado_sesion, iniciado_en, ultimo_cambio_en)
      VALUES (?, ?, 'PENDING', ?, ?)
    `).run(sesion_id, firmaId, now.toISOString(), now.toISOString());

    // Registrar evento CREATED
    db.prepare(`
      INSERT INTO gh_firma_eventos
        (firma_id, evento, fecha_hora, ip, user_agent, id_actor, metadata)
      VALUES (?, 'CREATED', ?, ?, ?, ?, ?)
    `).run(
      firmaId, now.toISOString(), ip || null, user_agent || null,
      'rh:system', JSON.stringify({
        id_documento, tipo_firma, ttl_horas, document_hash: calculated_hash,
      }),
    );

    return firmaId;
  });
  const firmaId = tx();

  // URL pública
  const url_publica = `${config.publicUrl}/s/${token}`;

  logger.info('SignRequest creado', {
    id_solicitud,
    id_trabajador,
    tipo_firma,
    ttl_horas,
  });

  const signRequest = getById(firmaId);
  return { signRequest, token, url_publica };
}

/**
 * Obtiene por ID interno.
 */
function getById(id) {
  if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) return null;
  return db.prepare(`
    SELECT id, id_solicitud, id_documento, id_trabajador, id_empresa,
           tipo_firma, estado, document_hash_original, document_hash_firmado,
           agreement_hash, evidence_hash, token_hash, identificacion_tipo,
           identificacion_numero_hash, identificacion_coincidio,
           correo_verificacion, correo_hash, otp_hash, otp_sal,
           otp_intentos, otp_bloqueado, ip_origen, user_agent,
           sesion_id, verification_channel, fecha_creacion, fecha_expiracion,
           fecha_apertura, fecha_otp_enviado, fecha_otp_verificado,
           fecha_documento_visto, fecha_manifestacion, fecha_firma,
           fecha_revocacion, motivo_revocacion, motivo_rechazo,
           version_kair, manifestacion_voluntad_texto,
           manifestacion_voluntad_hash, pdf_original_path, pdf_firmado_path,
           constancia_path, metadata
    FROM gh_firmas_electronicas
    WHERE id = ?
    LIMIT 1
  `).get(id);
}

/**
 * Obtiene por id_solicitud (SIGN-YYYY-NNNNNN).
 */
function getByIdSolicitud(id_solicitud) {
  if (typeof id_solicitud !== 'string' || id_solicitud.length === 0) return null;
  return db.prepare(`
    SELECT *
    FROM gh_firmas_electronicas
    WHERE id_solicitud = ?
    LIMIT 1
  `).get(id_solicitud);
}

/**
 * Obtiene por token_hash. Usado para validar tokens al recibirlos.
 * NO retorna el token original (solo el hash está en BD).
 */
function getByTokenHash(token_hash) {
  if (typeof token_hash !== 'string' || token_hash.length === 0) return null;
  return db.prepare(`
    SELECT *
    FROM gh_firmas_electronicas
    WHERE token_hash = ?
    LIMIT 1
  `).get(token_hash);
}

/**
 * Lista solicitudes con filtros y paginación.
 */
function list({
  id_empresa, estado, id_trabajador, id_documento,
  desde, hasta, limit = 50, offset = 0,
} = {}) {
  const where = [];
  const params = {};

  if (id_empresa) {
    where.push('id_empresa = @id_empresa');
    params.id_empresa = id_empresa;
  }
  if (estado) {
    const estados = Array.isArray(estado) ? estado : [estado];
    const placeholders = estados.map((_, i) => `@estado${i}`).join(',');
    where.push(`estado IN (${placeholders})`);
    estados.forEach((e, i) => { params[`estado${i}`] = e; });
  }
  if (id_trabajador) {
    where.push('id_trabajador = @id_trabajador');
    params.id_trabajador = id_trabajador;
  }
  if (id_documento) {
    where.push('id_documento = @id_documento');
    params.id_documento = id_documento;
  }
  if (desde) {
    where.push('fecha_creacion >= @desde');
    params.desde = desde;
  }
  if (hasta) {
    where.push('fecha_creacion <= @hasta');
    params.hasta = hasta;
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);

  const items = db.prepare(`
    SELECT id, id_solicitud, id_documento, id_trabajador, id_empresa,
           tipo_firma, estado, fecha_creacion, fecha_expiracion, fecha_firma
    FROM gh_firmas_electronicas
    ${whereClause}
    ORDER BY fecha_creacion DESC
    LIMIT @limit OFFSET @offset
  `).all({ ...params, limit: safeLimit, offset: safeOffset });

  const total = db.prepare(`
    SELECT COUNT(*) AS n FROM gh_firmas_electronicas ${whereClause}
  `).get(params).n;

  return { items, total, limit: safeLimit, offset: safeOffset };
}

/**
 * Registra un evento en gh_firma_eventos.
 */
function registerEvent(firmaId, evento, metadata, actor, ip, user_agent) {
  const fecha_hora = new Date().toISOString();
  db.prepare(`
    INSERT INTO gh_firma_eventos
      (firma_id, evento, fecha_hora, ip, user_agent, metadata, id_actor)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    firmaId, evento, fecha_hora, ip || null, user_agent || null,
    metadata ? JSON.stringify(metadata) : null, actor || 'sistema',
  );
}

module.exports = {
  create,
  getById,
  getByIdSolicitud,
  getByTokenHash,
  list,
  registerEvent,
  MAX_PDF_SIZE,
};
