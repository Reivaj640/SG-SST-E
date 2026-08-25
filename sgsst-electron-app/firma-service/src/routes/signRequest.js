/**
 * Rutas de Sign Request.
 *
 * - POST /internal/sign-requests                                 (multipart, crea)
 * - GET  /internal/sign-requests/:id                             (consulta por id_solicitud o id interno)
 * - GET  /internal/sign-requests                                 (lista con filtros)
 * - GET  /internal/sign-requests?ids=id1,id2,id3                 (I-008: batch, internalServerLimiter 4 capas)
 * - GET  /internal/sign-requests/:id/document.pdf                (I-103: PDF descargable autenticado)
 * - GET  /internal/sign-requests/:id/constancia.pdf              (I-104: Constancia descargable autenticada)
 * - GET  /internal/sign-requests/:id/link                        (I-013b: link recovery)
 *
 * Auth (I-010, D-13, I-008): los 7 endpoints usan `requireEmpresaScopeAndLimit`
 * para scope per-empresa + rate limit interno (4 capas, I-008 / C-20 v5).
 *
 * Ver API.md §6.1, §6.2, §6.8 y docs/kair-firma-integration/I-010-design.md,
 * docs/kair-firma-integration/READY-TO-IMPLEMENT.md (I-007, I-008, I-103,
 * I-104, I-013b).
 */
'use strict';

const express = require('express');
const router = express.Router();
const { requireEmpresaScopeAndLimit } = require('../middleware/authz');
const { requireIdempotencyKey } = require('../middleware/idempotency');
const { uploadPdf } = require('../middleware/upload');
const pdfValidation = require('../middleware/pdfValidation');
const { validateBody } = require('../middleware/validate');
const {
  signRequestBody, signRequestListQuery, signRequestIdsQuery,
  signRequestNotifyBody,  // I-103.A1.5.1
} = require('../schemas');
const signRequestService = require('../services/signRequest');
const storage = require('../services/storage');
const { AppError } = require('../middleware/errors');
const logger = require('../utils/logger');
const config = require('../config');

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
      // I-007: campos para UI. Se exponen en el response body pero el
      // token real NUNCA se reconstruye (está hasheado en BD, ver C-22).
      //   - qr_payload, link: null en GET /:id. Si K+AIR los necesita,
      //     debe llamar I-013b (GET /:id/link) que retorna el token
      //     descifrado de metadata._server_metadata con auditoría.
      //   - tiene_pdf_firmado / tiene_constancia: flags booleanos que
      //     indican si los archivos están disponibles para descarga vía
      //     I-103 / I-104. NO exponemos los paths internos (riesgo de
      //     fuga de info sobre el filesystem del servidor).
      qr_payload: null,
      link: null,
      tiene_pdf_original: !!signRequest.pdf_original_path,
      tiene_pdf_firmado: !!signRequest.pdf_firmado_path,
      tiene_constancia: !!signRequest.constancia_path,
      // I-007: hashes de evidencia forense (post-SIGNED).
      // Solo se exponen si están calculados (estado SIGNED).
      // En estados anteriores son null (no se han calculado todavía).
      ...(signRequest.document_hash_firmado
          ? { document_hash_firmado: signRequest.document_hash_firmado } : {}),
      ...(signRequest.evidence_hash
          ? { evidence_hash: signRequest.evidence_hash } : {}),
      ...(signRequest.id_constancia
          ? { id_constancia: signRequest.id_constancia } : {}),
      ...(signRequest.manifestacion_voluntad_hash
          ? { manifestacion_voluntad_hash: signRequest.manifestacion_voluntad_hash } : {}),
      // motivo_rechazo solo si estado=REJECTED (relevante para UI).
      ...(signRequest.estado === 'REJECTED' && signRequest.motivo_rechazo
          ? { motivo_rechazo: signRequest.motivo_rechazo } : {}),
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

// =============================================================================
// I-008: GET /internal/sign-requests?ids=id1,id2,id3 (batch)
// =============================================================================
// Polling optimizado para K+AIR (cada 30s con todos los sign requests activos
// en UN solo request). Reemplaza el polling individual que haría N requests
// por tanda y agotaría la Capa 1 (720/h por id_empresa).
//
// Comportamiento:
//   - Acepta `ids` como CSV. Cada id puede ser `SIGN-YYYY-NNNNNN` o entero.
//   - Retorna 200 con { total, items, missing, forbidden }.
//     - items: sign requests encontrados Y autorizados (pertenecen al cliente).
//     - missing: ids que no existen en BD (404 silent).
//     - forbidden: ids que existen pero pertenecen a OTRA empresa. K+AIR
//       recibe este feedback para mostrar UI coherente sin revelar la
//       existencia del recurso cross-company (404 silent del lado server).
//   - El batch cuenta como UN solo hit en el rate limit (4 capas).
//
// Casos de error:
//   - 400 INVALID_REQUEST_BODY si ids falta, está vacío o tiene >200 entradas.
//   - 401, 403, 429: manejados por el middleware.

router.get('/sign-requests-batch',
  requireEmpresaScopeAndLimit({
    allowedOperations: ['sign_request:read'],
    rateLimit: { tier: 'standard' },
  }),
  (req, res, next) => {
    try {
      // 1. Validar query
      const result = signRequestIdsQuery.safeParse(req.query);
      if (!result.success) {
        return res.status(400).json({
          error: {
            code: 'INVALID_REQUEST_BODY',
            message: 'Query params inválidos para batch',
            details: { issues: result.error.issues },
            request_id: req.id,
          },
        });
      }
      const ids = result.data.ids.split(',').map(s => s.trim()).filter(Boolean);

      // 2. Batch lookup (service layer)
      const byId = signRequestService.getByIds(ids);

      // 3. Separar en items / missing / forbidden
      //    Regla cross-company: en client mode, los sign requests de otra
      //    empresa van a `forbidden` (no se filtra la existencia al cliente
      //    de otra empresa). En legacy mode, todos van a `items` (compat).
      const items = [];
      const missing = [];
      const forbidden = [];
      const seen = new Set();

      for (const rawId of ids) {
        if (seen.has(rawId)) continue;  // dedup en el response
        seen.add(rawId);

        const row = byId.get(rawId);
        if (!row) {
          missing.push(rawId);
          continue;
        }
        if (req.authSource === 'client' && row.id_empresa !== req.id_empresa) {
          forbidden.push(rawId);
          continue;
        }
        items.push(row);
      }

      // 4. Response
      res.json({
        total: items.length,
        missing_count: missing.length,
        forbidden_count: forbidden.length,
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
        missing,
        forbidden,
      });
    } catch (err) {
      next(err);
    }
  });

// =============================================================================
// I-103: GET /internal/sign-requests/:id/document.pdf
// =============================================================================
// Descarga autenticada del PDF (firmado post-SIGNED, original pre-SIGNED).
// Sustituye el placeholder `pdf_firmado_url` que el commit() retorna pero
// que NO apuntaba a un endpoint real (ver INTEGRATION.md §2.2, gap I-103).
//
// Lógica:
//   - Si signRequest.estado === 'SIGNED' y pdf_firmado_path existe:
//     devuelve el PDF firmado.
//   - Si signRequest NO está en SIGNED y pdf_original_path existe:
//     devuelve el PDF original (preview sin firmar). Útil para que K+AIR
//     muestre el documento antes de la firma.
//   - Si no hay PDF disponible: 404 PDF_NOT_FOUND.
//
// Auth: requiereEmpresaScopeAndLimit con sign_request:read. Cross-company → 404.

router.get('/sign-requests/:id/document.pdf',
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
        return res.status(400).json({
          error: {
            code: 'INVALID_REQUEST_BODY',
            message: 'id debe ser SIGN-YYYY-NNNNNN o entero positivo',
            request_id: req.id,
          },
        });
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

      // Cross-company silent 404
      if (req.authSource === 'client' && signRequest.id_empresa !== req.id_empresa) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: `Solicitud ${id} no encontrada`,
            request_id: req.id,
          },
        });
      }

      // Determinar qué PDF servir
      const isSigned = signRequest.estado === 'SIGNED';
      const pathToServe = isSigned ? signRequest.pdf_firmado_path : signRequest.pdf_original_path;
      const fileLabel = isSigned ? 'firmado' : 'original';

      if (!pathToServe) {
        return res.status(404).json({
          error: {
            code: 'PDF_NOT_FOUND',
            message: `El PDF (${fileLabel}) no está disponible para esta solicitud`,
            request_id: req.id,
          },
        });
      }

      const result = storage.readPdfIfExists(pathToServe);
      if (!result.found) {
        return res.status(404).json({
          error: {
            code: 'PDF_NOT_FOUND',
            message: `El archivo del PDF (${fileLabel}) no existe en disco`,
            request_id: req.id,
          },
        });
      }

      const filename = isSigned
        ? `${signRequest.id_solicitud}.pdf`
        : `${signRequest.id_solicitud}-original.pdf`;

      res.set('Content-Type', 'application/pdf');
      res.set('Content-Disposition', `${isSigned ? 'inline' : 'attachment'}; filename="${filename}"`);
      res.set('X-Content-Type-Options', 'nosniff');
      res.set('Cache-Control', 'private, no-cache');
      res.send(result.buffer);
    } catch (err) {
      next(err);
    }
  });

// =============================================================================
// I-104: GET /internal/sign-requests/:id/constancia.pdf
// =============================================================================
// Descarga autenticada de la Constancia. Solo disponible si el sign request
// está en estado SIGNED (la constancia se genera en commit()).
//
// Lógica:
//   - Si signRequest.estado !== 'SIGNED' → 409 CONSTANCIA_NOT_AVAILABLE.
//   - Si constancia_path está null o el archivo no existe en disco → 404.
//   - Cross-company → 404 silent.

router.get('/sign-requests/:id/constancia.pdf',
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
        return res.status(400).json({
          error: {
            code: 'INVALID_REQUEST_BODY',
            message: 'id debe ser SIGN-YYYY-NNNNNN o entero positivo',
            request_id: req.id,
          },
        });
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

      // Cross-company silent 404
      if (req.authSource === 'client' && signRequest.id_empresa !== req.id_empresa) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: `Solicitud ${id} no encontrada`,
            request_id: req.id,
          },
        });
      }

      // Solo post-SIGNED
      if (signRequest.estado !== 'SIGNED') {
        return res.status(409).json({
          error: {
            code: 'CONSTANCIA_NOT_AVAILABLE',
            message: `La constancia solo está disponible cuando la solicitud está en estado SIGNED`,
            details: { current_state: signRequest.estado },
            request_id: req.id,
          },
        });
      }

      if (!signRequest.constancia_path) {
        return res.status(404).json({
          error: {
            code: 'PDF_NOT_FOUND',
            message: 'La ruta de la constancia no está registrada en BD',
            request_id: req.id,
          },
        });
      }

      const result = storage.readPdfIfExists(signRequest.constancia_path);
      if (!result.found) {
        return res.status(404).json({
          error: {
            code: 'PDF_NOT_FOUND',
            message: 'El archivo de la constancia no existe en disco',
            request_id: req.id,
          },
        });
      }

      const filename = `${signRequest.id_solicitud}-constancia.pdf`;

      res.set('Content-Type', 'application/pdf');
      res.set('Content-Disposition', `inline; filename="${filename}"`);
      res.set('X-Content-Type-Options', 'nosniff');
      res.set('Cache-Control', 'private, no-cache');
      res.send(result.buffer);
    } catch (err) {
      next(err);
    }
  });

// =============================================================================
// I-013b: GET /internal/sign-requests/:id/link (recuperación)
// =============================================================================
// Recupera el token perdido (C-22) para K+AIR. El token se almacena cifrado
// con AES-256-GCM en `metadata._server_metadata.token_encrypted` (ver
// signRequest.js create()). Solo accesible si el sign request NO está en
// estado terminal.
//
// Comportamiento:
//   - 200 con { id_solicitud, token, url_publica, qr_payload,
//     fecha_expiracion, estado } si se puede descifrar.
//   - 410 GONE con code LINK_NOT_AVAILABLE si estado terminal.
//   - 410 GONE con code LINK_NOT_AVAILABLE y reason='legacy_no_token_recovery'
//     si el sign request es pre-I-013b (no tiene token cifrado).
//   - 404 NOT_FOUND si no existe o cross-company (silent).
//   - Registra evento LINK_RETRIEVED en gh_firma_eventos (auditoría Bloque E7).

router.get('/sign-requests/:id/link',
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
        return res.status(400).json({
          error: {
            code: 'INVALID_REQUEST_BODY',
            message: 'id debe ser SIGN-YYYY-NNNNNN o entero positivo',
            request_id: req.id,
          },
        });
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

      // Cross-company silent 404
      if (req.authSource === 'client' && signRequest.id_empresa !== req.id_empresa) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: `Solicitud ${id} no encontrada`,
            request_id: req.id,
          },
        });
      }

      // Estado terminal → 410
      const terminalStates = ['SIGNED', 'REJECTED', 'REVOKED', 'EXPIRED', 'CANCELLED'];
      if (terminalStates.includes(signRequest.estado)) {
        return res.status(410).json({
          error: {
            code: 'LINK_NOT_AVAILABLE',
            message: `El link no está disponible en estado terminal '${signRequest.estado}'`,
            details: { current_state: signRequest.estado, reason: 'terminal_state' },
            request_id: req.id,
          },
        });
      }

      // Intentar recuperar el token
      const recovery = signRequestService.getTokenForRecovery(signRequest);
      if (!recovery.found) {
        return res.status(410).json({
          error: {
            code: 'LINK_NOT_AVAILABLE',
            message: 'El link no se puede recuperar (sign request legacy o cifrado corrupto)',
            details: { reason: recovery.reason },
            request_id: req.id,
          },
        });
      }

      // Auditoría: registrar evento LINK_RETRIEVED
      try {
        signRequestService.registerEvent(
          signRequest.id,
          'LINK_RETRIEVED',
          {
            via: 'I-013b',
            api_key_hash_prefix: req.api_key_hash_prefix || null,
          },
          `rh:${req.api_key_hash_prefix || 'system'}`,
          req.ip,
          req.get('User-Agent') || null,
        );
      } catch (e) {
        // Loguear pero no fallar — la recuperación es exitosa aunque la
        // auditoría falle.
        logger.warn('I-013b: no se pudo registrar evento LINK_RETRIEVED', {
          id_solicitud: signRequest.id_solicitud,
          error: e.message,
        });
      }

      logger.info('Link recuperado', {
        id_solicitud: signRequest.id_solicitud,
        actor: req.api_key_hash_prefix || 'system',
        ip: req.ip,
      });

      res.json({
        id_solicitud: signRequest.id_solicitud,
        token: recovery.token,
        url_publica: recovery.url_publica,
        qr_payload: recovery.url_publica,
        fecha_expiracion: signRequest.fecha_expiracion,
        estado: signRequest.estado,
      });
    } catch (err) {
      next(err);
    }
  });

// =============================================================================
// I-103.A1.5.1: POST /internal/sign-requests/:id/notify-remote
// =============================================================================
// Envía (o re-envía) la invitación al firmante por correo. Es el "primer
// contacto" con el firmante después de que K+AIR creó el sign request. NO
// genera ni envía OTP (eso ocurre en publicFlow.identify cuando el firmante
// abre la URL).
//
// Auth: requireEmpresaScopeAndLimit con sign_request:read (mismo que /link).
// Re-uso de operation porque semánticamente es "leer el sign request para
// obtener su link cifrado y enviarlo". NO requiere nueva operation.
//
// Status codes:
//   - 200: invitación enviada (con messageId + sent_at)
//   - 400: body inválido (sin correo, formato inválido, etc.) — zod
//   - 401/403/429: manejados por el middleware
//   - 404 NOT_FOUND: sign request no existe O cross-company (silent)
//   - 410 GONE INVITE_NOT_AVAILABLE:
//       - sign request en estado terminal (SIGNED/REJECTED/REVOKED/EXPIRED/CANCELLED)
//       - sign request sin token cifrado (legacy pre-I-013b)
//   - 502 BAD_GATEWAY INVITE_EMAIL_FAILED: mailer lanzó (SMTP caído, red, etc.)
//
// Side effects:
//   - INSERT en gh_firma_eventos (evento=INVITE_SENT)
//   - SMTP send (dev: jsonTransport, prod: nodemailer real)
//
// Idempotencia: NO se implementa explícita (cada llamada genera un nuevo
// INVITE_SENT en auditoría + potencialmente un correo nuevo). Rate limit
// del middleware (4 capas) previene abuse.

router.post('/sign-requests/:id/notify-remote',
  requireEmpresaScopeAndLimit({
    allowedOperations: ['sign_request:read'],
    rateLimit: { tier: 'standard' },
  }),
  validateBody(signRequestNotifyBody),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      let signRequest;

      // Mismo patrón que /link: aceptar SIGN-YYYY-NNNNNN o entero positivo.
      if (/^SIGN-\d{4}-\d{6}$/.test(id)) {
        signRequest = signRequestService.getByIdSolicitud(id);
      } else if (/^\d+$/.test(id)) {
        signRequest = signRequestService.getById(parseInt(id, 10));
      } else {
        return res.status(400).json({
          error: {
            code: 'INVALID_REQUEST_BODY',
            message: 'id debe ser SIGN-YYYY-NNNNNN o entero positivo',
            request_id: req.id,
          },
        });
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

      // Cross-company silent 404 (no revelar existencia de recurso cross-company).
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

      // Estado terminal: 410. Mismo set que /link (no se re-envía invitación
      // a un sign request que ya firmó, rechazó, expiró, fue revocado o
      // cancelado).
      const terminalStates = ['SIGNED', 'REJECTED', 'REVOKED', 'EXPIRED', 'CANCELLED'];
      if (terminalStates.includes(signRequest.estado)) {
        return res.status(410).json({
          error: {
            code: 'INVITE_NOT_AVAILABLE',
            message: `No se puede enviar invitación en estado terminal '${signRequest.estado}'`,
            details: { current_state: signRequest.estado, reason: 'terminal_state' },
            request_id: req.id,
          },
        });
      }

      // Llamar al service. Él se encarga de:
      //   - Recuperar el token vía getTokenForRecovery (lanza 410 si legacy)
      //   - Enviar el correo vía mailer.sendInvite (lanza 502 si SMTP falla)
      //   - Registrar evento INVITE_SENT (best-effort)
      const result = await signRequestService.notifyRemote(
        signRequest,
        req.body.correo,
        {
          actor: req.api_key_hash_prefix
            ? `rh:${req.api_key_hash_prefix}`
            : 'sistema',
          ip: req.ip,
          user_agent: req.get('User-Agent') || null,
          context: req.body.context || null,
        }
      );

      res.json({
        ok: true,
        id_solicitud: signRequest.id_solicitud,
        messageId: result.messageId,
        sent_at: result.sent_at,
        evento_id: result.evento_id,
      });
    } catch (err) {
      // AppError: el service lo lanza con códigos ricos (410, 502, etc.).
      // Dejamos que el errorHandler central los traduzca.
      next(err);
    }
  }
);

module.exports = router;
