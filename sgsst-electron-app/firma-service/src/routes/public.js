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

const path = require('path');
const express = require('express');
const router = express.Router();
const { validateBody } = require('../middleware/validate');
const publicFlow = require('../services/publicFlow');
const signRequestService = require('../services/signRequest');
const storage = require('../services/storage');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errors');

const { z } = require('zod');

// Ruta al HTML estático de la mini-app (resuelta desde SERVICE_ROOT)
const MINI_APP_HTML = path.resolve(__dirname, '..', '..', 'web', 'firma', 'index.html');

/**
 * Enmascara un correo para exposición pública: "jrf2011@live.com" → "jrf****@live.com".
 * Helper local (presentación); NO se importa de publicFlow.js para evitar
 * acoplamiento entre la ruta y la lógica de negocio.
 * Retorna '' si el correo es null/undefined/inválido.
 */
function _maskEmailPublico(email) {
  if (typeof email !== 'string' || !email.includes('@')) return '';
  const [local, domain] = email.split('@');
  if (!local || !domain) return '';
  if (local.length <= 2) return local[0] + '****@' + domain;
  return local.slice(0, 2) + '****@' + domain;
}

const identifyBody = z.object({
  // D-1 (I-002): rename tipo_documento → tipo_identificacion.
  // Es el tipo de documento de IDENTIFICACIÓN del firmante (CC, CE, TI,
  // PPT, PA). NO se debe confundir con el campo del sign request
  // `tipo_identificacion` (categoría del doc que se firma: CONTRATO, etc.).
  tipo_identificacion: z.enum(['CC', 'CE', 'TI', 'PPT', 'PA']),
  numero_documento: z.string().min(4).max(20).regex(/^\d+$/, 'Solo dígitos'),
});

const verifyOtpBody = z.object({
  otp: z.string().regex(/^\d{6}$/, 'OTP debe ser 6 dígitos numéricos'),
});

const viewDocumentBody = z.object({
  segundos_en_pagina: z.number().int().min(0).max(3600).optional(),
  scroll_al_final: z.boolean(),
});

const commitBody = z.object({
  manifestacion_aceptada: z.literal(true),
  firma_visual_png: z.string().optional(),
});

const rejectBody = z.object({
  motivo: z.string().max(1000).optional(),
});

/**
 * GET /s/:token
 *
 * Bifurcación por Accept:
 *   - text/html: sirve la mini-app (index.html). El JS extrae el token del path
 *     y luego hace fetch con Accept: application/json para obtener el contexto.
 *   - application/json (o cualquier otro): devuelve el contexto público.
 *
 * Registrar OPENED solo cuando se devuelve el contexto JSON, NO en cada recarga
 * del HTML (sería ruido de auditoría).
 */
router.get('/s/:token', (req, res, next) => {
  // Si el cliente quiere HTML (navegador), servir la mini-app estática.
  // Importante: el JS hace fetch con Accept: application/json explícito.
  if (req.accepts(['html', 'json']) === 'html') {
    return res.sendFile(MINI_APP_HTML, {
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      },
    });
  }

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
      // Tipo de documento de IDENTIFICACIÓN del firmante (CC, CE, TI, PPT, PA).
      // Es lo que la mini-app muestra/usa para la pantalla de identify.
      identificacion_tipo: signRequest.identificacion_tipo,
      // I-002: categoría del documento QUE SE FIRMA (CONTRATO, OTROSI, ACTA, etc.).
      // La mini-app lo muestra como contexto ("Estás firmando un CONTRATO").
      // Puede ser null para sign requests legacy pre-migration 007.
      tipo_identificacion: signRequest.tipo_identificacion,
      // I-103.A1.6 · Correo enmascarado del firmante, para mostrar en la
      // pantalla OTP cuando el firmante re-abre el enlace y ya pasó por
      // identificación. Solo se expone si estado >= IDENTIFIED (después
      // de identificar); antes de eso, el firmante aún no ha confirmado
      // a qué correo se envió el OTP, así que no lo exponemos.
      correo_enmascarado: (estado === 'IDENTIFIED' ||
                           estado === 'OTP_SENT' ||
                           estado === 'OTP_VERIFIED' ||
                           estado === 'DOCUMENT_OPENED' ||
                           estado === 'DOCUMENT_VIEWED' ||
                           estado === 'SIGNED')
        ? _maskEmailPublico(signRequest.correo_verificacion)
        : null,
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
      req.body.tipo_identificacion,  // D-1 (I-002): antes tipo_documento
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
 *
 * NOTA sobre CSP: para este endpoint especifico, relajamos la directiva
 * `frame-ancestors` de 'none' a 'self'. Esto permite que la mini-app
 * (mismo origen) incruste el PDF en su visor iframe. La CSP global de
 * server.js mantiene 'none', por lo que las demas respuestas siguen
 * protegidas contra incrustacion externa (anti-clickjacking).
 * Solo sobreescribimos la directiva `frame-ancestors`; las demas
 * directivas de la CSP (default-src, script-src, etc.) permanecen
 * identicas a las del helmet global.
 */
router.get('/api/sign/:token/document.pdf', (req, res, next) => {
  try {
    const { buffer, filename } = publicFlow.getPdfForToken(req.params.token);

    // Override quirurgico: solo cambiamos `frame-ancestors` de 'none' a 'self'.
    // Conservamos el resto de directivas CSP de helmet intactas.
    const currentCsp = res.getHeader('Content-Security-Policy');
    if (typeof currentCsp === 'string' && currentCsp.includes("frame-ancestors 'none'")) {
      const newCsp = currentCsp.replace(
        /frame-ancestors 'none'/,
        "frame-ancestors 'self'"
      );
      res.set('Content-Security-Policy', newCsp);
    }

    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `inline; filename="${filename}"`);
    res.set('X-Content-Type-Options', 'nosniff');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/sign/:token/commit
 * Cierra la firma (transición atómica a SIGNED).
 */
router.post('/api/sign/:token/commit', validateBody(commitBody), async (req, res, next) => {
  try {
    const result = await publicFlow.commit(
      req.params.token,
      req.body,
      req.ip,
      req.get('User-Agent'),
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/sign/:token/reject
 * Registra rechazo explícito del documento.
 */
router.post('/api/sign/:token/reject', validateBody(rejectBody), (req, res, next) => {
  try {
    const result = publicFlow.reject(
      req.params.token,
      req.body.motivo,
      req.ip,
      req.get('User-Agent'),
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
