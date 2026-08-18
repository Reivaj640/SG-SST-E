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

const verifyOtpBody = z.object({
  otp: z.string().regex(/^\d{6}$/, 'OTP debe ser 6 dígitos numéricos'),
});

const viewDocumentBody = z.object({
  segundos_en_pagina: z.number().int().min(0).max(3600).optional(),
  scroll_al_final: z.boolean(),
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

/**
 * POST /api/sign/:token/verify-otp
 * Verifica el OTP. Si es correcto, marca estado=OTP_VERIFIED.
 */
router.post('/api/sign/:token/verify-otp', validateBody(verifyOtpBody), (req, res, next) => {
  try {
    const result = publicFlow.verifyOtp(
      req.params.token,
      req.body.otp,
      req.ip,
      req.get('User-Agent'),
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/sign/:token/view-document
 * Registra que el trabajador vio el documento (scroll al final).
 * Transiciona a DOCUMENT_VIEWED.
 */
router.post('/api/sign/:token/view-document', validateBody(viewDocumentBody), (req, res, next) => {
  try {
    const result = publicFlow.viewDocument(
      req.params.token,
      {
        segundosEnPagina: req.body.segundos_en_pagina,
        scrollAlFinal: req.body.scroll_al_final,
      },
      req.ip,
      req.get('User-Agent'),
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/sign/:token/document.pdf
 * Devuelve el PDF del documento.
 */
router.get('/api/sign/:token/document.pdf', (req, res, next) => {
  try {
    const { buffer, filename } = publicFlow.getPdfForToken(req.params.token);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `inline; filename="${filename}"`);
    res.set('X-Content-Type-Options', 'nosniff');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
