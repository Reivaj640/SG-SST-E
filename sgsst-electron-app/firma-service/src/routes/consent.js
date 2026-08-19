/**
 * Rutas de Consentimiento del Acuerdo de uso.
 *
 * - POST /internal/consentimientos
 * - POST /internal/consentimientos/:id/verify-otp
 *
 * Auth (I-010, D-13): ambos endpoints usan `requireEmpresaScope` para
 * scope per-empresa.
 *
 * Ver API.md §6.10 y §6.11 y docs/kair-firma-integration/I-010-design.md.
 */
'use strict';

const express = require('express');
const router = express.Router();
const { requireEmpresaScope } = require('../middleware/authz');
const { validateBody } = require('../middleware/validate');
const { createConsentBody, verifyOtpBody } = require('../schemas');
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
  requireEmpresaScope({
    allowedOperations: ['consent:create'],
    checkIdEmpresa: true,
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
    const response = {
      consent_id: result.consent.id,
      version_acuerdo: result.consent.version_acuerdo,
      hash_texto_acuerdo: result.consent.hash_texto_acuerdo,
      estado: result.consent.estado,
      otp_ttl_seconds: config.ttl.otpSeconds,
      correo_destino_enmascarado: maskEmail(correo_verificacion),
    };

    // En dev, devolver el OTP solo si lo capturamos
    if (result.devOtp) {
      response.devOtp = result.devOtp;
    }

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
  requireEmpresaScope({
    allowedOperations: ['consent:verify'],
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

module.exports = router;
