/**
 * Rutas de Consentimiento del Acuerdo de uso.
 *
 * - POST /internal/consentimientos
 * - POST /internal/consentimientos/:id/verify-otp
 * - POST /internal/consentimientos/:id/expire      (FASE 3 · A1.5.4-B, admin)
 *
 * Auth (I-010, D-13, I-008):
 *   - create / verify-otp: `requireEmpresaScopeAndLimit`
 *     (per-empresa + rate limit interno, 4 capas, I-008 / C-20 v5).
 *   - expire: `adminApiAuth` (operación humana, no expuesta a K+AIR).
 *
 * Ver API.md §6.10, §6.11, §6.12 (expire) y docs/kair-firma-integration/I-010-design.md.
 */
'use strict';

const express = require('express');
const { z } = require('zod');
const router = express.Router();
const { requireEmpresaScopeAndLimit } = require('../middleware/authz');
const { adminApiAuth } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const { AppError } = require('../middleware/errors');
const {
  createConsentBody, verifyOtpBody, expireConsentBody,
} = require('../schemas');
const consentService = require('../services/consent');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * POST /internal/consentimientos
 * Crea un consentimiento y envía OTP.
 *
 * I-010 (D-13): per-company authz. `checkIdEmpresa: true` valida que el
 * id_empresa del body coincida con la empresa del cliente autenticado.
 * En client mode mismatch → 403 EMPRESA_MISMATCH.
 * En legacy mode (deprecation), se permite cualquier id_empresa.
 */
router.post('/consentimientos',
  requireEmpresaScopeAndLimit({
    allowedOperations: ['consent:create'],
    checkIdEmpresa: true,
    rateLimit: { tier: 'standard' },
  }),
  validateBody(createConsentBody),
  async (req, res, next) => {
  try {
    const { id_trabajador, id_empresa, version_acuerdo, correo_verificacion, kair_version } = req.body;
    const ip = req.ip;
    const user_agent = req.get('User-Agent') || null;

    const result = await consentService.create({
      id_trabajador, id_empresa, version_acuerdo,
      correo_verificacion, kair_version, ip, user_agent,
    });

    // Caso 1: ya aceptado
    if (result.alreadyAccepted) {
      logger.info('Consentimiento ya aceptado', {
        consent_id: result.consent.id,
        id_trabajador,
      });
      return res.status(200).json({
        ok: true,
        already_accepted: true,
        consent_id: result.consent.id,
        version_acuerdo: result.consent.version_acuerdo,
        fecha_aceptacion: result.consent.fecha_aceptacion,
        manifestacion_aceptada: true,
      });
    }

    // Caso 2: ya pending
    if (result.alreadyPending) {
      logger.info('Consentimiento ya pending', {
        consent_id: result.consent.id,
        id_trabajador,
      });
      return res.status(409).json({
        error: {
          code: 'CONSENT_PENDING',
          message: 'Ya existe un consentimiento pendiente para esta versión',
          details: { consent_id: result.consent.id },
          request_id: req.id,
        },
      });
    }

    // Caso 3: nuevo
    // FASE 4 · A1.5.4-B: el consent ya no tiene OTP. No se envía
    // correo en este paso. La aceptación del Acuerdo ocurre en la
    // mini-app (3ª casilla) vía POST /api/sign/:token/consent/accept.
    const response = {
      consent_id: result.consent.id,
      version_acuerdo: result.consent.version_acuerdo,
      hash_texto_acuerdo: result.consent.hash_texto_acuerdo,
      estado: result.consent.estado,
      manifestacion_aceptada: result.consent.manifestacion_aceptada === 1,
      correo_destino_enmascarado: maskEmail(correo_verificacion),
    };

    res.status(201).json(response);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /internal/consentimientos/:id/verify-otp
 * Verifica el OTP y acepta el consentimiento.
 *
 * I-010 (D-13): per-company authz post-lookup. Después de obtener el
 * consentimiento, si el cliente es per-empresa y el consentimiento
 * pertenece a OTRA empresa, retornar 404 (silent) en vez de 403.
 * En legacy mode (deprecation), se permite el acceso.
 */
router.post('/consentimientos/:id/verify-otp',
  requireEmpresaScopeAndLimit({
    allowedOperations: ['consent:verify'],
    rateLimit: { tier: 'standard' },
  }),
  validateBody(verifyOtpBody),
  (req, res, next) => {
    try {
      const consentId = parseInt(req.params.id, 10);
      if (!Number.isInteger(consentId) || consentId <= 0) {
        throw new (require('../middleware/errors').AppError)(400, 'INVALID_REQUEST_BODY',
          'El id del consentimiento debe ser un entero positivo');
      }

      // Lookup preliminar para check per-empresa post-lookup.
      // Esto NO es un cambio de comportamiento para legacy mode.
      const { AppError } = require('../middleware/errors');
      const db = require('../db/connection');
      const consentRow = db.prepare(
        'SELECT id, id_empresa, estado FROM gh_consentimientos_firma WHERE id = ?'
      ).get(consentId);
      if (!consentRow) {
        // Dejar que el service lance el 404 nativo (CONSENT_NOT_FOUND).
      } else if (req.authSource === 'client' &&
                 consentRow.id_empresa !== req.id_empresa) {
        throw new AppError(404, 'NOT_FOUND',
          `Consentimiento ${consentId} no encontrado`,
          { consent_id: consentId });
      }

      const { otp, kair_version } = req.body;
      const result = consentService.verifyOtp({ consentId, otp, kair_version });

      res.json({
        ok: true,
        consent_id: result.consent.id,
        version_acuerdo: result.consent.version_acuerdo,
        estado: result.consent.estado,
        fecha_aceptacion: result.consent.fecha_aceptacion,
        manifestacion_aceptada: result.consent.manifestacion_aceptada === 1,
      });
    } catch (err) {
      next(err);
    }
  });

function maskEmail(email) {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  const visible = local.slice(0, Math.min(4, local.length));
  return `${visible}${'*'.repeat(Math.max(0, local.length - visible.length))}@${domain}`;
}

// =================================================================
// POST /internal/consentimientos/:id/expire   (FASE 3 · A1.5.4-B)
// =================================================================

/**
 * Expira un consentimiento administrativamente. Operación humana, admin-only.
 *
 * Caso de uso: un consentimiento quedó colgado en OTP_PENDING (OTP nunca
 * llegó al firmante, typo en el correo, buzón lleno, etc.) y bloquea la
 * creación de un nuevo consentimiento para la misma key por la UNIQUE
 * constraint de gh_consentimientos_firma.
 *
 * Auth: X-Admin-API-Key (operación humana, NO expuesta a K+AIR).
 * Body: { motivo: string(>=10,<=500), actor: string(>=1,<=100) }
 *
 * - 401 si falta o es incorrecto X-Admin-API-Key
 * - 400 si body inválido o :id mal formado
 * - 404 si el consentimiento no existe
 * - 409 CONSENT_EXPIRE_NOT_ALLOWED si el estado es terminal (ACCEPTED/EXPIRED)
 * - 200 con estado EXPIRED si se expiró exitosamente
 * - 200 con already_expired=true si ya estaba EXPIRED (idempotente)
 */
router.post('/consentimientos/:id/expire',
  adminApiAuth(),
  validateBody(expireConsentBody),
  (req, res, next) => {
    try {
      const consentId = parseInt(req.params.id, 10);
      if (!Number.isInteger(consentId) || consentId <= 0) {
        throw new AppError(400, 'INVALID_REQUEST_BODY',
          'El id del consentimiento debe ser un entero positivo');
      }
      const { motivo, actor } = req.body;
      const ip = req.ip;
      const user_agent = req.get('User-Agent') || null;

      const result = consentService.expireConsent({
        consentId, motivo, actor, ip, user_agent,
      });

      logger.info('Consentimiento expirado por admin', {
        consent_id: consentId,
        estado_anterior: result.estado_anterior,
        already_expired: result.already_expired,
        actor,
        ip,
      });

      const response = {
        ok: true,
        consent_id: result.consent.id,
        version_acuerdo: result.consent.version_acuerdo,
        estado: result.consent.estado,
        estado_anterior: result.estado_anterior,
        fecha_expiracion: result.consent.updated_at,
        actor,
      };
      if (result.already_expired) {
        response.already_expired = true;
      }
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
