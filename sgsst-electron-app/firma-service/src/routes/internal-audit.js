/**
 * Rutas de operación interna para audit trail y revocación.
 *
 * - GET  /internal/sign-requests/:id/eventos
 *     Devuelve la línea de tiempo de eventos de un sign request,
 *     con filtrado de secretos en metadata.
 * - POST /internal/sign-requests/:id/revoke
 *     Revoca una solicitud activa (operación humana, admin-only).
 *
 * Auth:
 *   - eventos → requireEmpresaScope (X-Internal-API-Key, K+AIR, per-company D-13)
 *   - revoke  → adminApiAuth        (X-Admin-API-Key, operador humano)
 *
 * Ver API.md §6.4 (revoke) y §6.7 (eventos). Ver C:\Temp\e7-design.md
 * y docs/kair-firma-integration/I-010-design.md.
 */
'use strict';

const express = require('express');
const { z } = require('zod');
const router = express.Router();
const db = require('../db/connection');
const { adminApiAuth } = require('../middleware/auth');
const { requireEmpresaScope } = require('../middleware/authz');
const { validateBody } = require('../middleware/validate');
const { AppError } = require('../middleware/errors');
const signRequestService = require('../services/signRequest');
const logger = require('../utils/logger');

// =================================================================
// Constantes
// =================================================================

/**
 * Estados desde los que SÍ se puede revocar.
 * Excluye explícitamente los 5 terminales (SIGNED, REJECTED, REVOKED,
 * EXPIRED, CANCELLED) y los 4 intermedios no listados en el enunciado
 * (OTP_SENT, DOCUMENT_OPENED, MANIFESTATION_RECORDED, OTP_LOCKED,
 * IDENTIFICATION_FAILED). Ver C:\Temp\e7-design.md §5.
 */
const REVOKE_ALLOWED_STATES = [
  'PENDING',                  // ex "CREATED" en el enunciado del usuario
  'OPENED',
  'IDENTIFICATION_STARTED',
  'IDENTIFIED',
  'OTP_VERIFIED',
  'DOCUMENT_VIEWED',
];

/**
 * Denylist de claves de metadata que se filtran en audit trail.
 * Ver C:\Temp\e7-design.md §8.
 */
const SECRET_METADATA_KEYS = new Set([
  'token', 'token_hash', 'token_sal', 'token_original', 'tokens',
  'otp', 'otp_code', 'otp_hash', 'otp_sal', 'otp_intentos',
  'identificacion_numero', 'identificacion_numero_hash',
  'cedula', 'documento_numero',
  'correo_verificacion', 'correo_hash', 'correo_sal', 'correo', 'email',
  'api_key', 'admin_api_key', 'internal_api_key',
  'secret', 'password', 'pass',
  'private_key', 'public_key',
  'firma_visual_png', 'firma_visual',
]);

// =================================================================
// Helpers
// =================================================================

/**
 * Resuelve el path param `:id` a una tupla { kind, value, row }.
 * Devuelve null si el formato es inválido.
 */
function parseSignRequestId(id) {
  if (typeof id !== 'string' || id.length === 0) return null;
  if (/^SIGN-\d{4}-\d{6}$/.test(id)) {
    const sr = signRequestService.getByIdSolicitud(id);
    if (sr) return { kind: 'id_solicitud', value: id, row: sr };
    return null;  // formato OK pero no existe
  }
  if (/^\d+$/.test(id)) {
    const n = parseInt(id, 10);
    if (n > 0) {
      const sr = signRequestService.getById(n);
      if (sr) return { kind: 'id', value: n, row: sr };
      return null;  // id positivo pero no existe
    }
  }
  return null;  // formato inválido
}

/**
 * Filtra recursivamente los campos sensibles de un objeto de metadata.
 * Mantiene null/vacío como null (no como '[REDACTED]') para indicar
 * "no había valor".
 */
function redactSecrets(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(redactSecrets);
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SECRET_METADATA_KEYS.has(k.toLowerCase())) {
      out[k] = (v === null || v === undefined || v === '') ? null : '[REDACTED]';
    } else {
      out[k] = redactSecrets(v);
    }
  }
  return out;
}

/**
 * Parsea el JSON de metadata. Si falla, devuelve null (no propaga error).
 * Esto es defensivo: si un evento quedó con metadata corrupto, el endpoint
 * no debe fallar — solo retorna null.
 */
function parseMetadataSafe(metadata) {
  if (metadata === null || metadata === undefined) return null;
  if (typeof metadata !== 'string') return null;
  try {
    return JSON.parse(metadata);
  } catch {
    return null;
  }
}

/**
 * Schema zod del body de POST /internal/sign-requests/:id/revoke.
 */
const revokeBody = z.object({
  motivo: z.string()
    .min(10, 'motivo debe tener al menos 10 caracteres')
    .max(500, 'motivo debe tener máximo 500 caracteres')
    .refine(
      (v) => v.trim().length >= 10,
      'motivo no puede ser solo espacios en blanco',
    ),
  actor: z.string()
    .min(1, 'actor es requerido')
    .max(100, 'actor debe tener máximo 100 caracteres'),
}).strict();

// =================================================================
// GET /internal/sign-requests/:id/eventos
// =================================================================

/**
 * Devuelve los eventos de auditoría de un sign request, ordenados
 * por timestamp ASC, con filtrado de secretos en metadata.
 *
 * - 401 si falta o es incorrecto X-Internal-API-Key
 * - 400 si :id no es `SIGN-YYYY-NNNNNN` ni entero positivo
 * - 404 si el sign request no existe
 * - 200 con array (posiblemente vacío) si existe
 */
router.get('/sign-requests/:id/eventos',
  requireEmpresaScope({
    allowedOperations: ['audit:read'],
  }),
  (req, res, next) => {
    try {
      const parsed = parseSignRequestId(req.params.id);
      if (parsed === null) {
        // Distinguir formato inválido (400) vs no existe (404).
        // Si el id matchea uno de los formatos regex pero el lookup no
        // encontró nada → 404. Si no matchea ningún formato → 400.
        if (/^SIGN-\d{4}-\d{6}$/.test(req.params.id) || /^\d+$/.test(req.params.id)) {
          throw new AppError(404, 'NOT_FOUND',
            `Solicitud ${req.params.id} no encontrada`,
            { id: req.params.id });
        }
        throw new AppError(400, 'INVALID_REQUEST_BODY',
          'id debe ser SIGN-YYYY-NNNNNN o entero positivo',
          { received_id: req.params.id });
      }

      // I-010 (D-13): per-company authz post-lookup.
      // Si el cliente es per-empresa y la solicitud pertenece a OTRA
      // empresa, retornar 404 (silent) en vez de 403 para no filtrar
      // la existencia del recurso. En legacy mode, se permite el acceso.
      if (req.authSource === 'client' &&
          parsed.row.id_empresa !== req.id_empresa) {
        throw new AppError(404, 'NOT_FOUND',
          `Solicitud ${req.params.id} no encontrada`,
          { id: req.params.id });
      }

      // Query a gh_firma_eventos (índice idx_eventos_firma_fecha).
    const rows = db.prepare(`
      SELECT id, evento, fecha_hora, ip, user_agent, metadata, id_actor
      FROM gh_firma_eventos
      WHERE firma_id = ?
      ORDER BY fecha_hora ASC, id ASC
    `).all(parsed.row.id);

    const eventos = rows.map((r) => ({
      id: r.id,
      tipo_evento: r.evento,
      fecha_evento: r.fecha_hora,
      ip_origen: r.ip,
      user_agent: r.user_agent,
      actor: r.id_actor,
      metadata: redactSecrets(parseMetadataSafe(r.metadata)),
    }));

    logger.info('Audit trail consultado', {
      id_solicitud: parsed.row.id_solicitud,
      eventos_count: eventos.length,
      ip: req.ip,
    });

    res.json({
      id_solicitud: parsed.row.id_solicitud,
      total: eventos.length,
      eventos,
    });
  } catch (err) {
    next(err);
  }
});

// =================================================================
// POST /internal/sign-requests/:id/revoke
// =================================================================

/**
 * Revoca una solicitud de firma activa. Operación humana, admin-only.
 *
 * - 401 si falta o es incorrecto X-Admin-API-Key
 * - 400 si body inválido o :id mal formado
 * - 404 si el sign request no existe
 * - 409 REVOKE_NOT_ALLOWED si el estado actual no permite revoke
 * - 200 + already_revoked=true si ya estaba REVOKED (idempotente)
 * - 200 con estado REVOKED si se revocó exitosamente
 */
router.post('/sign-requests/:id/revoke',
  adminApiAuth(),
  validateBody(revokeBody),
  (req, res, next) => {
    try {
      const parsed = parseSignRequestId(req.params.id);
      if (parsed === null) {
        if (/^SIGN-\d{4}-\d{6}$/.test(req.params.id) || /^\d+$/.test(req.params.id)) {
          throw new AppError(404, 'NOT_FOUND',
            `Solicitud ${req.params.id} no encontrada`,
            { id: req.params.id });
        }
        throw new AppError(400, 'INVALID_REQUEST_BODY',
          'id debe ser SIGN-YYYY-NNNNNN o entero positivo',
          { received_id: req.params.id });
      }

      const { motivo, actor } = req.body;
      const ip = req.ip;
      const user_agent = req.get('User-Agent') || null;
      const now = new Date().toISOString();

      // Transacción atómica: leer estado, validar, UPDATE, registrar evento.
      const result = db.transaction(() => {
        // Releer estado DENTRO de la transacción (no usar el row del
        // parseSignRequestId porque pudo haber cambiado).
        const current = db.prepare(
          'SELECT id, id_solicitud, estado, fecha_revocacion, motivo_revocacion ' +
          'FROM gh_firmas_electronicas WHERE id = ?'
        ).get(parsed.row.id);

        if (!current) {
          // Race: el sign request fue borrado entre el parse y aquí.
          throw new AppError(404, 'NOT_FOUND',
            `Solicitud ${req.params.id} no encontrada`,
            { id: req.params.id });
        }

        // Idempotencia: si ya está REVOKED, devolver éxito sin cambios.
        if (current.estado === 'REVOKED') {
          return {
            id_solicitud: current.id_solicitud,
            id_interno: current.id,
            estado: 'REVOKED',
            estado_anterior: 'REVOKED',
            fecha_revocacion: current.fecha_revocacion,
            motivo_revocacion: current.motivo_revocacion,
            actor_revocacion: actor,
            already_revoked: true,
          };
        }

        // Validar estado permitido.
        if (!REVOKE_ALLOWED_STATES.includes(current.estado)) {
          throw new AppError(409, 'REVOKE_NOT_ALLOWED',
            `No se puede revocar una solicitud en estado ${current.estado}`,
            {
              current_state: current.estado,
              allowed_states: REVOKE_ALLOWED_STATES,
            });
        }

        // UPDATE atómico con guard de estado (patrón signRequest.js).
        const update = db.prepare(`
          UPDATE gh_firmas_electronicas
          SET estado = 'REVOKED',
              fecha_revocacion = ?,
              motivo_revocacion = ?
          WHERE id = ? AND estado = ?
        `).run(now, motivo, current.id, current.estado);

        if (update.changes === 0) {
          // Race: alguien cambió el estado entre SELECT y UPDATE.
          throw new AppError(409, 'REVOKE_NOT_ALLOWED',
            'El estado de la solicitud cambió durante el revoke (race condition)',
            { current_state: current.estado, allowed_states: REVOKE_ALLOWED_STATES });
        }

        // Registrar evento REVOKED.
        signRequestService.registerEvent(
          current.id,
          'REVOKED',
          {
            motivo,
            actor,
            estado_anterior: current.estado,
            timestamp: now,
          },
          `admin:${actor}`,
          ip,
          user_agent,
        );

        return {
          id_solicitud: current.id_solicitud,
          id_interno: current.id,
          estado: 'REVOKED',
          estado_anterior: current.estado,
          fecha_revocacion: now,
          motivo_revocacion: motivo,
          actor_revocacion: actor,
          already_revoked: false,
        };
      })();

      // Log de auditoría (fuera de transacción, no falla si hay error).
      logger.info('Sign request revocado', {
        id_solicitud: result.id_solicitud,
        estado_anterior: result.estado_anterior,
        already_revoked: result.already_revoked,
        actor,
        ip,
      });

      // Quitar campos internos de la respuesta.
      const response = {
        ok: true,
        id_solicitud: result.id_solicitud,
        id_interno: result.id_interno,
        estado: result.estado,
        estado_anterior: result.estado_anterior,
        fecha_revocacion: result.fecha_revocacion,
        motivo_revocacion: result.motivo_revocacion,
        actor: result.actor_revocacion,
      };
      if (result.already_revoked) {
        response.already_revoked = true;
      }
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
