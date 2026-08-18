/**
 * Rutas públicas del flujo de firma.
 *
 * - GET  /s/:token              (carga contexto público)
 * - POST /api/sign/:token/identify
 * - POST /api/sign/:token/verify-otp
 * - POST /api/sign/:token/view-document
 * - GET  /api/sign/:token/document.pdf
 * - POST /api/sign/:token/commit
 * - POST /api/sign/:token/reject
 *
 * El token en la URL es la credencial (no se usa API key).
 *
 * Ver API.md §5.
 */
'use strict';

const express = require('express');
const router = express.Router();
const { validateBody } = require('../middleware/validate');
const publicFlow = require('../services/publicFlow');
const signRequestService = require('../services/signRequest');
const storage = require('../services/storage');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errors');

const { z } = require('zod');

const identifyBody = z.object({
  tipo_documento: z.enum(['CC', 'CE', 'TI', 'PPT', 'PA']),
  numero_documento: z.string().min(4).max(20).regex(/^\d+$/, 'Solo dígitos'),
});

/**
 * GET /s/:token
 * Devuelve el contexto público para cargar la mini-app.
 * Registra OPENED si es la primera vez.
 */
router.get('/s/:token', (req, res, next) => {
  try {
    const { signRequest, estado } = publicFlow.resolveToken(req.params.token);
    publicFlow.registerOpenedIfFirst(signRequest, req.ip, req.get('User-Agent'));

    // Contexto mínimo para la mini-app. NO se exponen:
    //   - token_hash
    //   - identificacion_numero_hash
    //   - paths internos (pdf_original_path, etc.)
    //   - API keys
    res.json({
      id_solicitud: signRequest.id_solicitud,
      id_documento: signRequest.id_documento,
      id_trabajador: signRequest.id_trabajador,
      tipo_firma: signRequest.tipo_firma,
      estado: estado,
      fecha_expiracion: signRequest.fecha_expiracion,
      identificacion_tipo: signRequest.identificacion_tipo,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/sign/:token/identify
 * Identifica al trabajador por tipo + número de documento.
 */
router.post('/api/sign/:token/identify', validateBody(identifyBody), async (req, res, next) => {
  try {
    const result = await publicFlow.identify(
      req.params.token,
      req.body.tipo_documento,
      req.body.numero_documento,
      req.ip,
      req.get('User-Agent'),
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
