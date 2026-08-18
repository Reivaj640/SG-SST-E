/**
 * Rutas de Sign Request.
 *
 * - POST /internal/sign-requests  (multipart, crea)
 * - GET  /internal/sign-requests/:id  (consulta por id_solicitud o id interno)
 * - GET  /internal/sign-requests  (lista con filtros)
 *
 * Ver API.md §6.1, §6.2, §6.8.
 */
'use strict';

const express = require('express');
const router = express.Router();
const { internalApiAuth } = require('../middleware/auth');
const { uploadPdf } = require('../middleware/upload');
const { signRequestBody, signRequestListQuery } = require('../schemas');
const signRequestService = require('../services/signRequest');
const logger = require('../utils/logger');

/**
 * POST /internal/sign-requests
 * Crea una nueva solicitud de firma.
 *
 * multipart/form-data:
 *   - documento: archivo PDF
 *   - metadata: JSON string con id_documento, id_trabajador, etc.
 */
router.post('/sign-requests', internalApiAuth(), uploadPdf(), (req, res, next) => {
  try {
    // Parsear el campo 'metadata' (viene como JSON string en multipart)
    const metadataRaw = req.body.metadata;
    if (typeof metadataRaw !== 'string' || metadataRaw.length === 0) {
      return res.status(400).json({
        error: {
          code: 'INVALID_REQUEST_BODY',
          message: 'Falta el campo "metadata" en el form-data',
          request_id: req.id,
        },
      });
    }

    let metaObj;
    try {
      metaObj = JSON.parse(metadataRaw);
    } catch (e) {
      return res.status(400).json({
        error: {
          code: 'INVALID_REQUEST_BODY',
          message: 'El campo "metadata" debe ser JSON válido',
          details: { parse_error: e.message },
          request_id: req.id,
        },
      });
    }

    // Validar el objeto parseado
    const validation = signRequestBody.safeParse(metaObj);
    if (!validation.success) {
      return res.status(400).json({
        error: {
          code: 'INVALID_REQUEST_BODY',
          message: 'El metadata no cumple el schema',
          details: { issues: validation.error.issues },
          request_id: req.id,
        },
      });
    }
    const meta = validation.data;

    const result = signRequestService.create({
      id_documento: meta.id_documento,
      id_trabajador: meta.id_trabajador,
      id_empresa: meta.id_empresa,
      tipo_firma: meta.tipo_firma,
      agreement_hash: meta.agreement_hash,
      document_hash: meta.document_hash,
      pdf_buffer: req.file.buffer,
      pdf_filename: req.file.originalname,
      version_kair: meta.version_kair,
      metadata: meta.metadata,
      ip: req.ip,
      user_agent: req.get('User-Agent') || null,
    });

    // IMPORTANTE: el token SOLO se retorna en esta respuesta.
    // Después, solo se almacena token_hash en BD.
    res.status(201).json({
      id_solicitud: result.signRequest.id_solicitud,
      id_interno: result.signRequest.id,
      tipo_firma: result.signRequest.tipo_firma,
      token: result.token,
      url_publica: result.url_publica,
      qr_payload: result.url_publica,
      document_hash_original: result.signRequest.document_hash_original,
      agreement_hash: result.signRequest.agreement_hash,
      fecha_creacion: result.signRequest.fecha_creacion,
      fecha_expiracion: result.signRequest.fecha_expiracion,
      estado: result.signRequest.estado,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /internal/sign-requests/:id
 * Consulta por id_solicitud (SIGN-YYYY-NNNNNN) o por id interno numérico.
 */
router.get('/sign-requests/:id', internalApiAuth(), (req, res, next) => {
  try {
    const { id } = req.params;
    let signRequest;

    if (/^SIGN-\d{4}-\d{6}$/.test(id)) {
      signRequest = signRequestService.getByIdSolicitud(id);
    } else if (/^\d+$/.test(id)) {
      signRequest = signRequestService.getById(parseInt(id, 10));
    } else {
      signRequest = null;
    }

    if (!signRequest) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: `Solicitud ${id} no encontrada`,
          request_id: req.id,
        },
      });
    }

    res.json({
      id_solicitud: signRequest.id_solicitud,
      id_interno: signRequest.id,
      id_documento: signRequest.id_documento,
      id_trabajador: signRequest.id_trabajador,
      id_empresa: signRequest.id_empresa,
      tipo_firma: signRequest.tipo_firma,
      estado: signRequest.estado,
      fecha_creacion: signRequest.fecha_creacion,
      fecha_expiracion: signRequest.fecha_expiracion,
      fecha_apertura: signRequest.fecha_apertura,
      fecha_otp_enviado: signRequest.fecha_otp_enviado,
      fecha_otp_verificado: signRequest.fecha_otp_verificado,
      fecha_documento_visto: signRequest.fecha_documento_visto,
      fecha_manifestacion: signRequest.fecha_manifestacion,
      fecha_firma: signRequest.fecha_firma,
      version_kair: signRequest.version_kair,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /internal/sign-requests
 * Lista con filtros.
 */
router.get('/sign-requests', internalApiAuth(), (req, res, next) => {
  try {
    // Parsear manualmente porque express.query es todo string
    const result = signRequestListQuery.safeParse(req.query);
    if (!result.success) {
      return res.status(400).json({
        error: {
          code: 'INVALID_REQUEST_BODY',
          message: 'Query params inválidos',
          details: { issues: result.error.issues },
          request_id: req.id,
        },
      });
    }
    const q = result.data;

    const { items, total, limit, offset } = signRequestService.list({
      id_empresa: q.id_empresa,
      estado: q.estado,
      id_trabajador: q.id_trabajador,
      id_documento: q.id_documento,
      desde: q.desde,
      hasta: q.hasta,
      limit: q.limit,
      offset: q.offset,
    });

    res.json({
      total,
      limit,
      offset,
      items: items.map(it => ({
        id_solicitud: it.id_solicitud,
        id_interno: it.id,
        id_documento: it.id_documento,
        id_trabajador: it.id_trabajador,
        id_empresa: it.id_empresa,
        tipo_firma: it.tipo_firma,
        estado: it.estado,
        fecha_creacion: it.fecha_creacion,
        fecha_expiracion: it.fecha_expiracion,
        fecha_firma: it.fecha_firma,
      })),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
