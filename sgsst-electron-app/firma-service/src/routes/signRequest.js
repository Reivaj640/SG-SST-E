/**
 * Rutas de Sign Request.
 *
 * - POST /internal/sign-requests  (multipart, crea)
 * - GET  /internal/sign-requests/:id  (consulta por id_solicitud o id interno)
 * - GET  /internal/sign-requests  (lista con filtros)
 *
 * Auth (I-010, D-13, I-008): los 3 endpoints usan `requireEmpresaScopeAndLimit`
 * para scope per-empresa + rate limit interno (4 capas, I-008 / C-20 v5).
 * El middleware hace authn (API key) + authz (per-empresa) + rate limit.
 * Reemplaza al antiguo `internalApiAuth` en estos 3 endpoints.
 *
 * Ver API.md §6.1, §6.2, §6.8 y docs/kair-firma-integration/I-010-design.md.
 */
'use strict';

const express = require('express');
const router = express.Router();
const { requireEmpresaScopeAndLimit } = require('../middleware/authz');
const { requireIdempotencyKey } = require('../middleware/idempotency');
const { uploadPdf } = require('../middleware/upload');
const pdfValidation = require('../middleware/pdfValidation');
const { signRequestBody, signRequestListQuery } = require('../schemas');
const signRequestService = require('../services/signRequest');
const { AppError } = require('../middleware/errors');
const logger = require('../utils/logger');

/**
 * POST /internal/sign-requests
 * Crea una nueva solicitud de firma.
 *
 * multipart/form-data:
 *   - documento: archivo PDF
 *   - metadata: JSON string con id_documento, id_trabajador, etc.
 */
router.post('/sign-requests',
  requireEmpresaScopeAndLimit({
    allowedOperations: ['sign_request:create'],
    // checkIdEmpresa NO se puede usar acá: el body es multipart y multer
    // lo parsea DESPUÉS de este middleware. El handler hace el check
    // post-parse (ver bloque "I-010 check body id_empresa" más abajo).
    rateLimit: { tier: 'standard' },
  }),
  uploadPdf(),
  // I-012.2: validacion estructural del PDF (servicio services/pdfValidator.js,
  // I-012.1). Calcula SHA-256 server-side y rechaza PDFs invalidos /
  // encriptados / demasiado grandes / con muchas paginas / parseo
  // excedido / metadata bomb → 422. El hash se expone en req.pdfValidation.sha256
  // y es el que se persiste (NO el que el cliente envio en metadata).
  pdfValidation(),
  // I-005: cableado de requireIdempotencyKey (I-003.3). Insertado DESPUES
  // de pdfValidation() porque el extractor de pdf_sha256 necesita
  // req.pdfValidation.sha256 (server-computed). El metadata se parsea del
  // mismo modo que el handler (JSON.parse del campo multipart) para que
  // el fingerprint sea consistente. Sin header Idempotency-Key el
  // middleware hace next() inmediatamente (G3, backward compat).
  requireIdempotencyKey({
    extractMetadata: (req) => {
      try { return JSON.parse(req.body.metadata || '{}'); }
      catch { return {}; }
    },
    extractPdfSha256: (req) => (req.pdfValidation && req.pdfValidation.sha256),
  }),
  (req, res, next) => {
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

    // I-010 (D-13): per-company authz post-parse del body multipart.
    // El middleware requireEmpresaScopeAndLimit corrió ANTES de multer, así que
    // no pudo checkar body.id_empresa. Lo hacemos acá, ya con metaObj.
    // En client mode + meta.id_empresa !== req.id_empresa → 403 EMPRESA_MISMATCH.
    // En legacy mode (deprecation), se permite cualquier id_empresa.
    if (req.authSource === 'client' &&
        typeof metaObj.id_empresa === 'string' &&
        metaObj.id_empresa.length > 0 &&
        metaObj.id_empresa !== req.id_empresa) {
      return res.status(403).json({
        error: {
          code: 'EMPRESA_MISMATCH',
          message: 'El id_empresa de la solicitud no coincide con la identidad autenticada',
          details: {
            auth_id_empresa: req.id_empresa,
            requested_id_empresa: metaObj.id_empresa,
          },
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
      agreement_version: meta.agreement_version,
      agreement_hash: meta.agreement_hash,
      // I-012.2: el hash del documento se calcula server-side en
      // pdfValidation() a partir de los bytes que multer nos entrego.
      // El cliente envia `meta.document_hash` para mantener compatibilidad
      // de schema, pero NO se usa: el cliente podria mentir sobre el hash
      // para bypassear el control de idempotencia (e.g. forzar colisiones
      // o evadir conflictos). El contrato de signRequest.create() exige
      // que document_hash coincida con el calculado, asi que pasarle el
      // server-computed garantiza que el check pasa y que document_hash
      // persistido es realmente el fingerprint del PDF recibido.
      document_hash: req.pdfValidation.sha256,
      pdf_buffer: req.file.buffer,
      pdf_filename: req.file.originalname,
      version_kair: meta.version_kair,
      identificacion_tipo: meta.identificacion_tipo,
      identificacion_numero_hash: meta.identificacion_numero_hash,
      consent_id: meta.consent_id,  // Bloque E6
      // I-002 (D-1): categoría del documento que se firma. DISTINTA de
      // `identificacion_tipo` (CC, CE, etc. del firmante). Hasta I-002 el
      // route no propagaba este campo; zod lo validaba y el service lo
      // aceptaba, pero terminaba en `undefined` → `null` en BD silencioso.
      tipo_identificacion: meta.tipo_identificacion,
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
      // I-002: confirmamos al cliente que el campo fue persistido (o null
      // si no se envió, en sign requests legacy pre-007).
      tipo_identificacion: result.signRequest.tipo_identificacion,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /internal/sign-requests/:id
 * Consulta por id_solicitud (SIGN-YYYY-NNNNNN) o por id interno numérico.
 */
router.get('/sign-requests/:id',
  requireEmpresaScopeAndLimit({
    allowedOperations: ['sign_request:read'],
    rateLimit: { tier: 'standard' },
  }),
  (req, res, next) => {
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

      // I-010 (D-13): per-company authz post-lookup.
      // Si el cliente es per-empresa (authSource='client') y la solicitud
      // pertenece a OTRA empresa, retornar 404 (silent) en vez de 403
      // para no filtrar la existencia del recurso.
      // En legacy mode (deprecation), se permite el acceso sin check.
      if (req.authSource === 'client' &&
          signRequest.id_empresa !== req.id_empresa) {
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
      agreement_version: signRequest.agreement_version,
      consent_id: signRequest.consent_id,  // Bloque E6
      // I-002: categoría del documento firmado. Null para legacy pre-007.
      tipo_identificacion: signRequest.tipo_identificacion,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /internal/sign-requests
 * Lista con filtros.
 *
 * I-010 (D-13): per-company authz.
 *  - En `client` mode: se PISA `q.id_empresa` con `req.id_empresa`. No hay
 *    forma de escapar el scope via query (?id_empresa=B es ignorado).
 *  - En `legacy` mode (deprecation): se respeta el `?id_empresa=` del query
 *    para mantener compatibilidad con K+AIR durante la migración.
 */
router.get('/sign-requests',
  requireEmpresaScopeAndLimit({
    allowedOperations: ['sign_request:read'],
    rateLimit: { tier: 'standard' },
  }),
  (req, res, next) => {
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

      // I-010: forzar id_empresa desde la identidad autenticada en client mode.
      // En legacy mode, respetar el query (compat con K+AIR pre-I-010).
      let effectiveEmpresa = q.id_empresa;
      if (req.authSource === 'client') {
        effectiveEmpresa = req.id_empresa;
      }

      const { items, total, limit, offset } = signRequestService.list({
        id_empresa: effectiveEmpresa,
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
